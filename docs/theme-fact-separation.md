# Theme is paint, never evidence

The Certification Dungeon is an unofficial study aid. It does not provide real
exam questions or an official practice assessment, and has no vendor
endorsement. Its original dungeon theme sits outside the grounded study engine.

## Hard boundary

| Factual layer: preserve exactly                     | Cosmetic layer: original presentation          |
| --------------------------------------------------- | ---------------------------------------------- |
| Credential names, types, status, objective versions | Dungeon nicknames, fictional bosses, biome art |
| Questions and scenario constraints                  | Encounter framing outside the question         |
| Options, distractors, correct-answer IDs            | Narrator reactions after an answer             |
| Code, commands, configuration, tables               | Torches, capes, stage props                    |
| Explanations and option-by-option reasons           | Separately labeled flavor paragraph            |
| Evidence summaries, citations, URLs, review dates   | “Tome” as a nearby navigation label            |
| Scoring, verified sample counts, readiness rules    | Cosmetic XP, loot, floor framing               |

Never rewrite a technical sentence into fantasy language. Never use a joke to
teach a product claim, diagnose a real failure, imply feature availability, or
replace a documented reason. A gateway, notebook, model, or pipeline mentioned
in a DM line is scenery, not a fault attribution or an architectural assertion.
If the distinction is not obvious from the line itself, rewrite the joke.

Personality files contain only structured flavor metadata and plain text.
Their parser rejects answer/evidence fields, markup, code/backticks, links,
unknown substitutions, and malformed metadata. The selection engine accepts
small contextual labels and observed run state; it does not receive question
bodies, answer keys, option text, explanations, or citations. No runtime model,
browser API key, telemetry, arbitrary URL proxy, or remote generation service
is part of this layer.

Structural validation is not independent technical verification. Adding a
personality record cannot create a source, attest a candidate, increase a
verified-question count, satisfy coverage, or unlock a dungeon.

## Render order and accessibility

1. Present the factual question and options unchanged.
2. During study feedback, lead with the neutral result and supported technical
   explanation, then show evidence and the individual option reasons.
3. Render optional DM text in its own `HostReaction` paragraph after the
   technical result. It has `aria-live="off"` and
   `data-personality="flavor"`; do not nest it inside a live technical result.
4. Citation links keep their actual official titles, destinations, safe
   protocol/target behavior, and review metadata. “Open tome” must not obscure
   which source is being opened.
5. Honor Full/Balanced/Reduced/Silent on every DM surface, including boss art
   narration, documentation reactions, return visits, weak-practice entries,
   and summaries. Silent hides flavor, never learning content.

No optional animation or narrator interlude should block a keyboard user,
delay feedback, steal focus, or override reduced motion. A dramatic boss
introduction must not reveal an answer or weaken exam-mode answer withholding.
Exam simulations remain neutral during the run; reactions belong in the debrief.

## Dungeon scope is not readiness

Use the actual encounter's `credentialId`, floor/objective, subject, and
difficulty for contextual selection. This is particularly important in a raid:
the currently displayed catalog card is not necessarily the source dungeon.
Dungeon extension applicability is a hard filter; an unrelated extension cannot
leak into an answer.

Flavor-only boss portraits may exist for sealed dungeons, including IDs whose
real credential identity is not yet verified. Those lines use generic IDs and
explicit fiction, not invented official names or availability. The catalog's
grounded readiness gates, not an illustration or a `boss-intro` message, control
entry. Do not invoke play-specific narration as a substitute for a sealed-state
explanation.

Boss wins, floor completions, streaks, and loot refer only to observed in-game
events. A strong sampled score does not prove objective mastery, predict an
official scaled score, or guarantee passing. Keep sample-size, coverage,
difficulty, freshness, and uncertainty qualifications in the factual results UI;
the DM must not contradict them.

## Change discipline

- Adding or editing only flavor requires personality schema, pool, context,
  repetition, preference, and accessibility tests.
- Changing any question, option, explanation, example, source, or objective
  requires the existing official grounding and independent verification
  workflow. Theme work is not an exemption.
- Refreshing official documentation must not silently rewrite a joke into a
  new technical claim.
- A new dungeon supplies data and optional flavor to the shared engine; do not
  fork the engine, scoring, or personality selector.

See [personality authoring](personality-authoring.md) for the versioned schema,
loading API, repetition rules, starter-pool counts, and validation commands.
