import { z } from 'zod';
import sharedPersonality from '../../content/personality.json';

export { banterLevels, type BanterLevel } from '../quiz/types';
export const reactionCatalogVersion = 2;
export const reactionCategories = [
  'correct',
  'incorrect',
  'partial',
  'unanswered',
  'time-expired',
  'streak',
  'broken-streak',
  'domain-perfect',
  'domain-strong',
  'domain-weak',
  'improved',
  'repeated-mistake',
  'session-complete',
  'score-high',
  'score-medium',
  'score-low',
  'expert-correct',
  'expert-miss',
  'documentation',
  'retry',
  'weak-practice',
  'returning',
  'start',
  'boss-intro',
  'boss-defeat',
  'boss-loss',
  'floor-cleared',
  'cursed-entry',
  'tome-opened',
] as const;
export type ReactionCategory = (typeof reactionCategories)[number];

export const personalityThemes = [
  'infra',
  'networking',
  'architecture',
  'security',
  'data',
  'fabric',
  'cosmosdb',
  'ai',
  'mlops',
  'devops',
  'github-copilot',
  'github-advanced-security',
  'sap',
  'windows-server',
  'documentation',
  'cross-dungeon',
] as const;

const variables = new Set([
  'domain',
  'skill',
  'difficulty',
  'streak',
  'dungeon',
  'credentialId',
  'floor',
  'objective',
]);
const textSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .refine(
    (text) => !/[<>`]|https?:\/\/|\[[^\]]+\]\(/i.test(text),
    'Flavor must be plain text, not markup, code, or a citation.',
  )
  .refine(
    (text) =>
      [...text.matchAll(/\{([^{}]*)\}/g)].every((match) =>
        variables.has(match[1]),
      ) && !/[{}]/.test(text.replace(/\{[^{}]*\}/g, '')),
    'Unknown or malformed personality variable.',
  );
const strings = z.array(z.string().trim().min(1));
const messageSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
    category: z.enum(reactionCategories),
    themes: strings.min(1),
    jokeThemes: strings.optional(),
    tone: z.enum(['warm', 'dry', 'celebratory']),
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    applicableDungeons: strings,
    applicableDomains: strings.default([]),
    applicableObjectives: strings.default([]),
    applicableDifficulties: z.array(
      z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    ),
    minStreak: z.number().int().nonnegative(),
    maxStreak: z.number().int().nonnegative().nullable(),
    minTimeMs: z.number().nonnegative().optional(),
    maxTimeMs: z.number().nonnegative().optional(),
    recovered: z.boolean().optional(),
    boss: z.boolean().optional(),
    text: textSchema,
    reducedBanterText: textSchema,
  })
  .strict()
  .refine(
    (message) =>
      message.maxStreak === null || message.maxStreak >= message.minStreak,
    'Maximum streak must not be below minimum streak.',
  )
  .refine(
    (message) =>
      message.minTimeMs === undefined ||
      message.maxTimeMs === undefined ||
      message.maxTimeMs >= message.minTimeMs,
    'Maximum response time must not be below minimum response time.',
  )
  .refine(
    (message) =>
      [
        message.themes,
        message.jokeThemes ?? [],
        message.applicableDungeons,
        message.applicableDomains,
        message.applicableObjectives,
        message.applicableDifficulties,
      ].every((values) => new Set(values).size === values.length),
    'Metadata lists must not contain duplicates.',
  );

export type PersonalityLine = z.infer<typeof messageSchema>;
export interface ReactionMessage extends PersonalityLine {
  /** Legacy runtime names retained for existing engine consumers. */
  minimumStreak: number;
  maximumStreak: number | null;
  opening: string;
}

export function openingForText(text: string): string {
  return text.split(/[\s.,!?—:]+/)[0].toLowerCase();
}

function rawLine(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('opening' in value))
    return value;
  const { opening, minimumStreak, maximumStreak, ...line } =
    value as ReactionMessage;
  void opening;
  return { ...line, minStreak: minimumStreak, maxStreak: maximumStreak };
}

/** Validates documents and runtime catalogs alike; no evaluation or HTML parsing. */
export function parseCatalog(input: unknown): readonly ReactionMessage[] {
  const lines: unknown[] = Array.isArray(input)
    ? input
    : z
        .object({
          version: z.literal(reactionCatalogVersion),
          messages: z.array(z.unknown()),
        })
        .strict()
        .parse(input).messages;
  const parsed = lines.map((line) => messageSchema.parse(rawLine(line)));
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const line of parsed) {
    const text = line.text.toLowerCase().replace(/\s+/g, ' ');
    if (ids.has(line.id))
      throw new Error(`Duplicate personality ID: ${line.id}`);
    if (texts.has(text))
      throw new Error(`Duplicate personality text: ${line.id}`);
    ids.add(line.id);
    texts.add(text);
  }
  return parsed.map((line) =>
    Object.freeze({
      ...line,
      minimumStreak: line.minStreak,
      maximumStreak: line.maxStreak,
      opening: openingForText(line.text),
    }),
  );
}

/** Extensions add entries, never replace shared IDs or imply credential readiness. */
export function mergeCatalog(
  base: unknown,
  extensions: readonly unknown[] = [],
): readonly ReactionMessage[] {
  return parseCatalog([
    ...parseCatalog(base),
    ...extensions.flatMap((extension) => parseCatalog(extension)),
  ]);
}

export const reactionCatalog = parseCatalog(sharedPersonality);

export const starterPoolMinimums = {
  correct: 30,
  incorrect: 30,
  streak: 15,
  'time-expired': 15,
  'session-complete': 20,
  documentation: 10,
  'weak-practice': 10,
} as const;

/** Shared-pool checks are separate: a valid two-line package extension is not a starter bank. */
export function validateStarterCatalog(input: unknown): {
  total: number;
  categories: Record<string, number>;
  themes: Record<string, number>;
} {
  const catalog = parseCatalog(input);
  const categories: Record<string, number> = {};
  const themes: Record<string, number> = {};
  for (const message of catalog) {
    categories[message.category] = (categories[message.category] ?? 0) + 1;
    for (const theme of message.themes)
      themes[theme] = (themes[theme] ?? 0) + 1;
  }
  for (const [category, minimum] of Object.entries(starterPoolMinimums)) {
    const general = catalog.filter(
      (line) =>
        line.category === category &&
        !line.applicableDungeons.length &&
        !line.applicableDomains.length &&
        !line.applicableObjectives.length,
    );
    if (general.length < minimum)
      throw new Error(
        `Personality ${category}: ${general.length}/${minimum} shared lines.`,
      );
    if (
      new Set(general.map((line) => line.opening)).size < Math.ceil(minimum / 2)
    )
      throw new Error(`Personality ${category} needs more distinct openings.`);
    if (new Set(general.map((line) => line.reducedBanterText)).size < minimum)
      throw new Error(
        `Personality ${category} needs distinct reduced alternatives.`,
      );
  }
  for (const theme of personalityThemes) {
    if (!themes[theme]) throw new Error(`Missing personality theme: ${theme}`);
  }
  for (const category of reactionCategories) {
    if (!categories[category])
      throw new Error(`Missing personality category: ${category}`);
  }
  return { total: catalog.length, categories, themes };
}
