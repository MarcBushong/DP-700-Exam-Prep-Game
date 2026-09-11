# Authoring the rogue Dungeon Master

The DM roots for the adventurer and teases a **choice**, never a person. The
voice is original, brief, theatrical, workplace-safe fantasy with public
technical vocabulary. It is not runtime AI, an official exam narrator, or a
source of technical truth. Do not insert organization-internal terminology.

## Content and loading

- `src/content/personality.json`: version 2 shared starter catalog.
- `src/content/exams/<credential-id>/personality.json`: additive, dungeon-scoped
  flavor. A sealed dungeon may have artwork and personality without any playable
  encounters. Its flavor does not establish a credential's official name,
  status, objectives, or readiness.
- `src/features/personality/catalog.ts`: parsing, uniqueness validation, merging,
  starter-pool thresholds, and theme/category vocabulary.
- `src/features/personality/reactions.ts`: the one shared selection engine.

The starter contains **242 lines in 29 categories**. Correct and incorrect have
32 general lines each plus three legacy domain-specific lines each. There are
15 streak, 15 timeout, 20 completion, 10 documentation, and 10 weak-practice
lines, plus contextual categories and 16 subject themes. Each of the 18
initial dungeon IDs has a distinct boss introduction and defeat extension:
36 additional lines, **278 combined**. These are authored flavor counts, not
verified-question counts.

The initial extensions were handed off in
`.grounding\dungeon\personality\<credential-id>.json`; packaged copies are the
runtime source of truth. Never import `.grounding` into the browser.

An extension document has this shape:

```json
{
  "version": 2,
  "messages": [
    {
      "id": "example.boss-intro.paper-dragon",
      "category": "boss-intro",
      "themes": ["architecture"],
      "jokeThemes": ["dragon"],
      "tone": "dry",
      "intensity": 2,
      "applicableDungeons": ["example"],
      "applicableDomains": [],
      "applicableObjectives": [],
      "applicableDifficulties": [],
      "minStreak": 0,
      "maxStreak": null,
      "text": "Paper dragon rehearses a dramatic bow. Read the question, not the costume.",
      "reducedBanterText": "Read the encounter carefully."
    }
  ]
}
```

Use stable, descriptive IDs, not array positions. Every line requires category,
themes, tone (`warm`, `dry`, `celebratory`), intensity (1–3), dungeon/difficulty
lists, streak bounds, and both text variants. Empty applicability lists mean
unrestricted; `maxStreak: null` means no upper bound. Domain/objective lists and
`jokeThemes` are optional. Joke motifs distinguish a torch, a clipboard, a
dragon, or a recurring meeting from the subject theme.

Optional `minTimeMs`, `maxTimeMs`, `recovered`, and `boss` constrain lines to
explicitly supplied context. Missing response time must not masquerade as a
fast or slow answer. Time never determines correctness. Use difficulty values
`beginner`, `intermediate`, `advanced`, or `expert`.

Keep full lines at most 220 characters before substitution. Use short display
labels in context; do not interpolate the question, answer, code, or explanation.
Allowed text variables: `{credentialId}`, `{dungeon}`, `{floor}`, `{objective}`,
`{domain}`, `{skill}`, `{difficulty}`, `{streak}`. Missing labels have neutral
fallbacks. Markup, code fences/backticks, URLs, unknown variables, duplicate IDs,
duplicate full text, malformed ranges, and unexpected fields fail validation.
This structural validator **does not prove that a joke is kind, original, or
fact-free**; review those qualities separately.

`parseCatalog(document)` produces runtime records. Existing consumers retain
`minimumStreak`, `maximumStreak`, and `opening`; JSON authors use `minStreak` and
`maxStreak`. Do not edit the derived fields.

## Runtime integration

```tsx
// Keep imported documents, options, and catalog references stable across renders.
<PersonalityProvider extensions={packagePersonalityDocuments}>
  <App />
</PersonalityProvider>
```

`PersonalityProvider` optionally accepts `catalog: readonly ReactionMessage[]`,
`extensions: readonly unknown[]`, and `options: ReactionOptions`. Package
loading stays in the caller: personality never imports credential packages,
sources, questions, readiness rules, or answer keys.

`mergeCatalog(base, extensions)` accepts version-2 JSON documents or normalized
runtime catalogs, validates each one and the combined result, and rejects
collisions rather than silently replacing shared lines.

The hook is backward compatible:

```ts
useReaction(
  scope,
  eventId,
  categories,
  (context = {}),
  (surface = 'context'),
  (enabled = true),
);
```

`ReactionContext` fields:

For gauntlets, also pass `runMode: 'gauntlet'`. All reactions are suppressed
unless `inProgress: false` explicitly identifies the debrief. Optional
`runMode: 'study' | 'raid'` retains normal chattiness behavior. Keep the UI's
independent guards for hints, answers, HP, and other outcome indicators;
personality suppression is defense in depth, not an answer-visibility gate.

| Purpose                | Optional fields                          |
| ---------------------- | ---------------------------------------- |
| Actual question origin | `credentialId`, `dungeon`                |
| Floor/domain           | `floorId`, `floor`, `domainId`, `domain` |
| Objective/skill        | `objectiveId`, `objective`, `skill`      |
| Subject matching       | `subjectTheme`, `themes: string[]`       |
| Difficulty and run     | `difficulty`, `streak`, `answerNumber`   |
| Observed answer event  | `timeMs`, `recovered`, `boss`            |

Use the **actual question's** credential, floor, objective, difficulty, elapsed
time, recovery state, and boss state, particularly during a cross-dungeon run.
Do not use the selected catalog card as a substitute for question provenance.
Use a stable run scope and an event ID for each actual answer/summary/opening.
Do not include a render counter in an event ID.

`ReactionSession(catalog, options)` supports `seed` or an injected `random`
function (the function wins if both are provided), `exhaustProportion` (default
0.8), and recent `themeWindow`/`openingWindow` (both default 2).
`ReactionSessions(catalog, options).get(scope, catalog?)` provides separate
sessions, optionally replacing a scope's catalog when its identity changes.
Up to 32 scope entries are retained; an evicted old scope starts fresh.

The hook selects only in an effect, never during render. An event cache makes
StrictMode replay and unrelated rerenders idempotent. Credential ID is part of
the event cache key, so identically named question events in different dungeons
cannot reuse the wrong dungeon's boss line. Preference changes reuse a cached
choice with the appropriate text variant rather than advancing the RNG.

`DocumentationReactions` also accepts `context?: ReactionContext`, and reacts
after activation of an `a.learn-link`; repeated activation of the same link in
the same scope is one event. It never fetches or rewrites the source.

## Selection and repetition

1. Try the requested categories in priority order. Unavailable specialized
   categories fall through to the caller's general category.
2. Hard-filter dungeon, domain/floor, objective, difficulty, streak, response
   time, recovery, and boss applicability.
3. Exclude IDs used in the recent eligible-category window. Its size is
   `min(pool size - 1, ceil(pool size * exhaustProportion))`. At 1.0 all members
   are consumed before reuse. Ineligible events from another dungeon do not
   spend this dungeon's pool.
4. Prefer a different ID, displayed opening, subject, and joke motif from the
   last event, then avoid recent themes/openings when alternatives remain.
5. Among the remaining choices, prefer dungeon, floor/objective, subject,
   difficulty, streak, and observed-event matches; resolve ties with the RNG.

The constraints relax only when no alternative remains, so single-line or
empty catalogs terminate safely. A topic match is a preference, not permission
to repeat the same joke on every question. Subject labels compare without case,
spaces, or punctuation, so `GitHub Copilot` matches `github-copilot`.

Legacy categories remain supported. New categories are `boss-intro`,
`boss-defeat`, `boss-loss`, `floor-cleared`, `cursed-entry`, and `tome-opened`.
`answerCategories` accepts an optional `boss` flag but never changes scoring.
Timeout/unanswered events outrank boss outcomes. Select floor, improvement,
streak, and summary categories only from real observed results.

## Chattiness and accessibility

| UI label | Stored value | Behavior                                                    |
| -------- | ------------ | ----------------------------------------------------------- |
| Full     | `full`       | Answers, summaries, optional context                        |
| Balanced | `balanced`   | Answers and summaries only                                  |
| Reduced  | `reduced`    | Every fourth answer and mild summaries; no optional context |
| Silent   | `none`       | No DM lines on any surface                                  |

The old `none` storage value is intentional. Legacy `reducedBanter` preferences
continue to work. Reduced uses `reducedBanterText`, warm tone, and intensity 1,
not a loud joke with fewer words. None consumes no reaction history or RNG.

Place neutral technical results and explanations **before** a `HostReaction`.
The latter is a separate plain-text paragraph, marked
`data-personality="flavor"` and `aria-live="off"`, not inside a technical live
region. Never allow banter settings to hide an explanation or alter an answer.

## Authoring review and checks

Review every full and reduced line as a human-facing utterance:

- Is the joke obviously fictional, short, original, and safe at work?
- Does it tease the selected choice rather than intelligence or identity?
- Is any apparent technical assertion really just scenery? Rewrite doubtful
  lines instead of relying on a blanket disclaimer.
- Does a result statement follow only from the category's actual event?
- Does the line avoid mastery, real credential availability, or pass guarantees?
- Are openings, imagery, themes, and reduced variants meaningfully varied?
- Does a sealed dungeon's portrait remain distinct from permission to play?

Run the existing tools from the repository root (PowerShell):

```powershell
npm test -- tests\personality.test.tsx tests\personality-catalog.test.tsx
npx eslint src\features\personality tests\personality-catalog.test.tsx
npx tsx -e "import { validateStarterCatalog, reactionCatalog } from './src/features/personality/catalog.ts'; console.log(validateStarterCatalog(reactionCatalog))"
```

The test suite reads the **real checked-in JSON**, validates all 18 packaged
extensions, checks pool thresholds and variety, exercises theme/context
matching, isolation/fallback, seeded repetition, scope caches, all banter
levels, technical-first DOM separation, and effect-only StrictMode behavior.
The TypeScript import in the final command is a module specifier, not a
PowerShell filesystem path.
