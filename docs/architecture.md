# Shared dungeon architecture

The Certification Dungeon evolves the original quiz engine. It is an unofficial
study aid, not an official exam, assessment, or vendor-endorsed product. Theme is
presentation: it never changes question facts, answers, explanations, code, or
citations.

## Content boundaries

`src\content\credentials\credentials.json` is the discovery catalog.
`hero-classes.json` contains public, generic many-to-many role mappings, not
required certification bundles. An entry can exist without a playable package;
requested identifiers are not evidence of a current credential.

Each installed encounter package at `src\content\exams\<credentialId>\` contains:

| File                                               | Responsibility                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `manifest.json`                                    | Package identity, objective version/history and product readiness thresholds |
| `objectives.json`                                  | Published domains, skills, subskills, effective version and retrieval date   |
| `questions.json`                                   | Original factual records, answers, explanations and citation snapshots       |
| `sources.json`                                     | Reviewed official-source manifest and genuine retrieval method/timestamps    |
| `verification-reviews.json`                        | Independently authored exact-content and per-option attestations             |
| `encounter-metadata.json`                          | Version/fingerprint-bound evidence envelope and independent realism rubric   |
| `personality.json`                                 | Presentation-only extensions, never factual rewrites                         |
| `question-bank-report.json`, `content-coverage.md` | Regenerable diagnostics, not evidence or verification                        |

Sealed catalog entries may have a **personality-only** directory without an
encounter package. Such a directory invents no questions, identity or objectives
and never opens a dungeon. Both readers distinguish it from an incomplete
encounter package; any other partial content files still fail validation.
`getDungeonPersonalityExtensions()` exposes a stable array of all authored
extension documents for the shared narrator provider, including sealed themes.

DP-700's four existing factual JSON files were moved byte-for-byte from
`src\data` into this package. The new envelope does not change the authored
question fingerprint. There is one bank, not a second independently editable
compatibility copy.

## Shared services

- `dungeons\catalog.ts`: credential and class parsing, catalog checks, discovery filters.
- `dungeons\sourcePolicy.ts`: strict legacy Learn URLs plus credential-scoped
  official source rules. Structural URL recognition is not relevance verification.
- `dungeons\validation.ts`: existing grounding checks, mandatory ledger bindings,
  evidence envelopes, independent rubrics, supported types and lifecycle gates.
- `dungeons\readiness.ts`: pure Study/Gauntlet readiness calculation.
- `dungeons\generation.ts`: browser-safe authoring-request payloads; no model,
  filesystem, secret, telemetry or runtime documentation proxy.
- `dungeons\lifecycle.ts`: read-only taxonomy diffs and affected encounter IDs.
- `dungeons\registry.ts`: globally unique encounter IDs across every installed
  package, including packages not selected for the current run. A collision
  seals every affected package without changing its factual records.
- `dungeons\packages.ts`: synchronous eager Vite JSON registry. Adding a valid
  catalog record and package directory needs no engine or loader edit.
- `scripts\content-files.ts`: Node package reader using the same validator,
  without importing the Vite registry or bundling Node APIs in the browser.

`getDungeonPackage(id)` returns the credential, playable `questions`, reportable
`allQuestions`, taxonomy, source manifest, reviews, envelope, objective version,
findings and `{study, gauntlet, reasons}` readiness. Unknown/malformed packages
fail closed. `listDungeons()` includes closed entries with truthful reasons.
`grounding\content.ts` remains a DP-700 compatibility export derived from the
registry, not a separate bank.

The browser and CLI share synchronous SHA-256 binding, verified against Node's
implementation and the preserved DP-700 ledger. Hashes prove content identity,
not factual accuracy, authentic reviewer identity, or independent thought.

## Quality and readiness

Every gameplay candidate must pass structural grounding, current objective
mapping, credential source policy, exact independent attestation, per-option
evidence and a realism rubric. Any changed source or objective snapshot excludes
the old encounter. Pending/rejected/stale records remain reportable.

The reviewer-authored rubric itself requires `objectiveVersion` and
`objectiveFingerprint`, not just the enclosing encounter envelope. The shared
`objectiveFingerprint(taxonomy)` helper (also exported by
`scripts\review-helpers.ts`) hashes the published version, exact guide URL and
ordered domain/skill/subskill/weight map with canonical object keys. Missing and
null unpublished weights normalize to null. Retrieval time is excluded from
this content hash, but the rubric's actual `reviewedAt` must still be at least
the taxonomy's `retrievedAt`. An unchanged refetch has the same map hash, not a
fabricated new edition.

Changing catalog/package/taxonomy/envelope versions or dates cannot carry an old
rubric forward: a mismatched independent binding makes the encounter effective
`stale`. Only an actual reviewer who re-reads the current outline may author new
bindings; no migration or validation tool generates them.

Study requires at least 25 eligible encounters, every major floor, active
verified identity and no blockers. Gauntlet requires at least 75, every skill
sampled at least twice, Advanced/Expert content, no major gaps and published
weighting when available. These are product thresholds, never fabricated
official duration, format or scoring claims. Configuration may strengthen but
not weaken the minimum quality floor.

`npm run content:validate-all` validates the entire catalog and every installed
package, including ledgers and envelopes. The build runs that gate before
TypeScript and Vite. Individual `questions:* -- --exam <credentialId>` commands
reuse the same checks. Only explicit custom `--questions` authoring can request
metadata-only inspection; it does not claim independent verification.
