import {
  reactionCatalog,
  type BanterLevel,
  type ReactionCategory,
  type ReactionMessage,
} from './catalog';

export interface ReactionContext {
  domainId?: string;
  domain?: string;
  skill?: string;
  difficulty?: string;
  streak?: number;
  answerNumber?: number;
}
export type ReactionSurface = 'answer' | 'summary' | 'context';
export interface Reaction extends ReactionMessage {
  renderedText: string;
}
export interface ReactionOptions {
  random?: () => number;
  exhaustProportion?: number;
  themeWindow?: number;
  openingWindow?: number;
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
    (!message.applicableDomains.length ||
      message.applicableDomains.includes(context.domainId ?? '')) &&
    (!message.applicableDifficulties.length ||
      message.applicableDifficulties.includes(context.difficulty ?? '')) &&
    (context.streak ?? 0) >= message.minimumStreak &&
    (message.maximumStreak === null ||
      (context.streak ?? 0) <= message.maximumStreak)
  );
}

function renderText(text: string, context: ReactionContext): string {
  const variables: Record<string, string> = {
    domain: context.domain ?? 'this domain',
    skill: context.skill ?? 'this skill',
    difficulty: context.difficulty ?? 'this difficulty',
    streak: String(context.streak ?? 0),
  };
  return text.replace(/\{(\w+)\}/g, (_, key: string) => variables[key] ?? '');
}

function openingFor(message: ReactionMessage, level: BanterLevel): string {
  return level === 'reduced'
    ? message.reducedBanterText.split(/[\s.,!?—:]+/)[0].toLowerCase()
    : message.opening;
}

export class ReactionSession {
  private readonly random: () => number;
  private readonly proportion: number;
  private readonly themeWindow: number;
  private readonly openingWindow: number;
  private readonly used: ReactionMessage[] = [];
  private readonly events = new Map<string, ReactionMessage>();

  constructor(
    private readonly catalog = reactionCatalog,
    options: ReactionOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.proportion = Math.min(
      1,
      Math.max(0, options.exhaustProportion ?? 0.8),
    );
    this.themeWindow = Math.max(1, options.themeWindow ?? 2);
    this.openingWindow = Math.max(1, options.openingWindow ?? 2);
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
    const cached = this.events.get(eventId);
    const message = cached ?? this.choose(categories, context, level);
    if (!message) return null;
    if (!cached) {
      this.events.set(eventId, message);
      this.used.push({ ...message, opening: openingFor(message, level) });
    }
    return {
      ...message,
      opening: openingFor(message, level),
      renderedText: renderText(
        level === 'reduced' ? message.reducedBanterText : message.text,
        context,
      ),
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
              .filter((message) => message.category === category)
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
      avoid((message) => message.id !== previous?.id);
      avoid(
        (message) =>
          !message.themes.some((theme) => previous?.themes.includes(theme)),
      );
      avoid((message) => openingFor(message, level) !== previous?.opening);
      const recentThemes = new Set(
        this.used.slice(-this.themeWindow).flatMap((message) => message.themes),
      );
      const recentOpenings = new Set(
        this.used.slice(-this.openingWindow).map((message) => message.opening),
      );
      avoid(
        (message) => !message.themes.some((theme) => recentThemes.has(theme)),
      );
      avoid((message) => !recentOpenings.has(openingFor(message, level)));
      const specificity = (message: ReactionMessage) =>
        message.applicableDomains.length +
        message.applicableDifficulties.length +
        Number(message.minimumStreak > 0);
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
}): ReactionCategory[] {
  if (input.timedOut) return ['time-expired', 'unanswered'];
  if (!input.selected.length) return ['unanswered'];
  if (input.correct) {
    return [
      ...(input.previousCorrect === false || input.recovered
        ? ['improved' as const]
        : []),
      ...(input.difficulty === 'expert' ? ['expert-correct' as const] : []),
      ...(input.streak >= 3 ? ['streak' as const] : []),
      'correct',
    ];
  }
  return [
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
