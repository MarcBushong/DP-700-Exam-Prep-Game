import {
  reactionCatalog,
  openingForText,
  type BanterLevel,
  type ReactionCategory,
  type ReactionMessage,
} from './catalog';

export interface ReactionContext {
  runMode?: 'study' | 'gauntlet' | 'raid';
  inProgress?: boolean;
  credentialId?: string;
  dungeon?: string;
  floorId?: string;
  floor?: string;
  objectiveId?: string;
  objective?: string;
  subjectTheme?: string;
  themes?: string[];
  domainId?: string;
  domain?: string;
  skill?: string;
  difficulty?: string;
  streak?: number;
  answerNumber?: number;
  timeMs?: number;
  recovered?: boolean;
  boss?: boolean;
}
export type ReactionSurface = 'answer' | 'summary' | 'context';
export interface Reaction extends ReactionMessage {
  renderedText: string;
}
export interface ReactionOptions {
  random?: () => number;
  seed?: number;
  exhaustProportion?: number;
  themeWindow?: number;
  openingWindow?: number;
}

export function seededReactionRandom(initialSeed: number): () => number {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function readBanterLevel(preferences: {
  banterLevel?: BanterLevel;
  reducedBanter?: boolean;
}): BanterLevel {
  return (
    preferences.banterLevel ??
    (preferences.reducedBanter ? 'reduced' : 'balanced')
  );
}

export function allowsReaction(
  level: BanterLevel,
  surface: ReactionSurface,
  context: ReactionContext,
): boolean {
  if (context.runMode === 'gauntlet' && context.inProgress !== false)
    return false;
  if (level === 'none') return false;
  if (level === 'full') return true;
  if (surface === 'context') return false;
  return (
    level === 'balanced' ||
    surface === 'summary' ||
    (context.answerNumber ?? 1) % 4 === 0
  );
}

function matches(message: ReactionMessage, context: ReactionContext): boolean {
  return (
    (!message.applicableDungeons.length ||
      message.applicableDungeons.includes(context.credentialId ?? '')) &&
    (!message.applicableDomains.length ||
      message.applicableDomains.includes(
        context.domainId ?? context.floorId ?? '',
      )) &&
    (!message.applicableObjectives.length ||
      message.applicableObjectives.includes(context.objectiveId ?? '')) &&
    (!message.applicableDifficulties.length ||
      message.applicableDifficulties.some(
        (difficulty) => difficulty === context.difficulty,
      )) &&
    (context.streak ?? 0) >= message.minimumStreak &&
    (message.maximumStreak === null ||
      (context.streak ?? 0) <= message.maximumStreak) &&
    (message.minTimeMs === undefined ||
      (Number.isFinite(context.timeMs) &&
        context.timeMs! >= message.minTimeMs)) &&
    (message.maxTimeMs === undefined ||
      (Number.isFinite(context.timeMs) &&
        context.timeMs! >= 0 &&
        context.timeMs! <= message.maxTimeMs)) &&
    (message.recovered === undefined ||
      message.recovered === context.recovered) &&
    (message.boss === undefined || message.boss === context.boss)
  );
}

function renderText(text: string, context: ReactionContext): string {
  const variables: Record<string, string> = {
    domain: context.domain ?? 'this domain',
    skill: context.skill ?? 'this skill',
    difficulty: context.difficulty ?? 'this difficulty',
    streak: String(context.streak ?? 0),
    credentialId: context.credentialId ?? 'this dungeon',
    dungeon: context.dungeon ?? context.credentialId ?? 'this dungeon',
    floor: context.floor ?? context.domain ?? 'this floor',
    objective: context.objective ?? context.skill ?? 'this objective',
  };
  return text.replace(/\{(\w+)\}/g, (_, key: string) => variables[key] ?? '');
}

export class ReactionSession {
  private readonly random: () => number;
  private readonly proportion: number;
  private readonly themeWindow: number;
  private readonly openingWindow: number;
  private readonly used: ReactionMessage[] = [];
  private readonly events = new Map<
    string,
    {
      message: ReactionMessage;
      historyIndex: number;
    }
  >();

  constructor(
    private readonly catalog: readonly ReactionMessage[] = reactionCatalog,
    options: ReactionOptions = {},
  ) {
    this.random =
      options.random ??
      (options.seed === undefined
        ? Math.random
        : seededReactionRandom(options.seed));
    this.proportion = Math.min(
      1,
      Math.max(
        0,
        Number.isFinite(options.exhaustProportion)
          ? options.exhaustProportion!
          : 0.8,
      ),
    );
    this.themeWindow = Math.max(
      1,
      Math.floor(
        Number.isFinite(options.themeWindow) ? options.themeWindow! : 2,
      ),
    );
    this.openingWindow = Math.max(
      1,
      Math.floor(
        Number.isFinite(options.openingWindow) ? options.openingWindow! : 2,
      ),
    );
  }

  reset() {
    this.used.length = 0;
    this.events.clear();
  }

  get history(): readonly ReactionMessage[] {
    return this.used;
  }

  react(
    eventId: string,
    categories: readonly ReactionCategory[],
    context: ReactionContext,
    level: BanterLevel,
    surface: ReactionSurface,
  ): Reaction | null {
    if (!allowsReaction(level, surface, context)) return null;
    const key = JSON.stringify([context.credentialId ?? '', eventId]);
    const cached = this.events.get(key);
    const message = cached?.message ?? this.choose(categories, context, level);
    if (!message) return null;
    const renderedText = renderText(
      level === 'reduced' ? message.reducedBanterText : message.text,
      context,
    );
    const opening = openingForText(renderedText);
    if (!cached) {
      this.events.set(key, { message, historyIndex: this.used.length });
      this.used.push({ ...message, opening });
    } else if (this.used[cached.historyIndex].opening !== opening) {
      // A preference change re-renders the same event without consuming another one.
      this.used[cached.historyIndex] = { ...message, opening };
    }
    return {
      ...message,
      intensity: level === 'reduced' ? 1 : message.intensity,
      tone: level === 'reduced' ? 'warm' : message.tone,
      opening,
      renderedText,
    };
  }

  private choose(
    categories: readonly ReactionCategory[],
    context: ReactionContext,
    level: BanterLevel,
  ): ReactionMessage | null {
    for (const category of categories) {
      const pool = this.catalog.filter(
        (message) => message.category === category && matches(message, context),
      );
      if (!pool.length) continue;
      const window = Math.min(
        pool.length - 1,
        Math.ceil(pool.length * this.proportion),
      );
      const recentIds = new Set(
        window
          ? this.used
              .filter((message) =>
                pool.some((eligible) => eligible.id === message.id),
              )
              .slice(-window)
              .map((message) => message.id)
          : [],
      );
      let candidates = pool.filter((message) => !recentIds.has(message.id));
      if (!candidates.length) candidates = pool;
      // Narrow only when alternatives remain: even a one-message pool terminates.
      const avoid = (test: (message: ReactionMessage) => boolean) => {
        const preferred = candidates.filter(test);
        if (preferred.length) candidates = preferred;
      };
      const previous = this.used.at(-1);
      const opening = (message: ReactionMessage) =>
        openingForText(
          renderText(
            level === 'reduced' ? message.reducedBanterText : message.text,
            context,
          ),
        );
      const differentTheme = (message: ReactionMessage) =>
        !message.themes.some((theme) => previous?.themes.includes(theme)) &&
        !(message.jokeThemes ?? []).some((theme) =>
          previous?.jokeThemes?.includes(theme),
        );
      avoid((message) => message.id !== previous?.id);
      avoid(
        (message) =>
          differentTheme(message) && opening(message) !== previous?.opening,
      );
      avoid(differentTheme);
      avoid((message) => opening(message) !== previous?.opening);
      const recentThemes = new Set(
        this.used.slice(-this.themeWindow).flatMap((message) => message.themes),
      );
      const recentOpenings = new Set(
        this.used.slice(-this.openingWindow).map((message) => message.opening),
      );
      const recentJokes = new Set(
        this.used
          .slice(-this.themeWindow)
          .flatMap((message) => message.jokeThemes ?? []),
      );
      avoid(
        (message) =>
          !message.themes.some((theme) => recentThemes.has(theme)) &&
          !(message.jokeThemes ?? []).some((theme) => recentJokes.has(theme)),
      );
      avoid((message) => !recentOpenings.has(opening(message)));
      const normalize = (theme: string) =>
        theme.toLowerCase().replace(/[^a-z0-9]/g, '');
      const requestedThemes = new Set(
        [...(context.themes ?? []), context.subjectTheme ?? ''].map(normalize),
      );
      const specificity = (message: ReactionMessage) =>
        Number(message.applicableDungeons.length > 0) * 8 +
        Number(message.applicableDomains.length > 0) * 4 +
        Number(message.applicableObjectives.length > 0) * 4 +
        Number(
          message.themes.some((theme) => requestedThemes.has(normalize(theme))),
        ) *
          3 +
        Number(message.applicableDifficulties.length > 0) * 2 +
        Number(message.minimumStreak > 0) +
        Number(
          message.minTimeMs !== undefined || message.maxTimeMs !== undefined,
        ) +
        Number(message.recovered !== undefined) +
        Number(message.boss !== undefined);
      const best = Math.max(...candidates.map(specificity));
      candidates = candidates.filter(
        (message) => specificity(message) === best,
      );
      const random = this.random();
      const index = Number.isFinite(random)
        ? Math.min(
            candidates.length - 1,
            Math.max(0, Math.floor(random * candidates.length)),
          )
        : 0;
      return candidates[index];
    }
    return null;
  }
}

export function answerCategories(input: {
  correct: boolean;
  selected: string[];
  correctAnswer: string[];
  timedOut: boolean;
  difficulty: string;
  streak: number;
  previousStreak: number;
  previousCorrect?: boolean;
  recovered?: boolean;
  boss?: boolean;
}): ReactionCategory[] {
  if (input.timedOut) return ['time-expired', 'unanswered'];
  if (!input.selected.length) return ['unanswered'];
  if (input.correct) {
    return [
      ...(input.boss ? ['boss-defeat' as const] : []),
      ...(input.previousCorrect === false || input.recovered
        ? ['improved' as const]
        : []),
      ...(input.difficulty === 'expert' ? ['expert-correct' as const] : []),
      ...(input.streak >= 3 ? ['streak' as const] : []),
      'correct',
    ];
  }
  return [
    ...(input.boss ? ['boss-loss' as const] : []),
    ...(input.correctAnswer.length > 1 &&
    input.selected.some((id) => input.correctAnswer.includes(id))
      ? ['partial' as const]
      : []),
    ...(input.previousCorrect === false ? ['repeated-mistake' as const] : []),
    ...(input.previousStreak >= 3 ? ['broken-streak' as const] : []),
    ...(input.difficulty === 'expert' ? ['expert-miss' as const] : []),
    'incorrect',
  ];
}

export function scoreCategory(percentage: number): ReactionCategory {
  return percentage >= 80
    ? 'score-high'
    : percentage >= 50
      ? 'score-medium'
      : 'score-low';
}

export function domainCategory(percentage: number): ReactionCategory {
  return percentage === 100
    ? 'domain-perfect'
    : percentage >= 70
      ? 'domain-strong'
      : 'domain-weak';
}
