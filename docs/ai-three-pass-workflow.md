# AI-103 and AI-200 three-pass content workflow

This is original, unofficial learning material, not a Microsoft practice exam,
endorsement or source of real exam questions. This document defines authoring
and integration requirements; it does not assert current credential availability,
completed reviews, achieved counts, retrieval dates or validation results.
Read [question-bank maintenance](question-bank-maintenance.md),
[source policy](source-policy.md) and [credential lifecycle](dungeon-lifecycle.md).

## Canonical packages, shared policy

Keep the existing canonical IDs `ai-103` and `ai-200`. AI-103's existing
30-record legacy bank is the starting inventory for fresh review, not 30
three-pass approvals. AI-200 is a new content package under its existing catalog
ID; a catalog entry alone is neither a current objective map nor playable content.
Do not create aliases as new packages, rename stored histories, or fork the
quiz engine, source validators, rubric implementation or readiness gates.

Both AI credentials must use the existing `three-pass-v1` profile. Pin the same
complete object in `credential.requiredReviewPolicy` and package `reviewPolicy`:
`version: "three-pass-v1"`, `sourcePolicy: "guide-linked-official"`,
`minimumRubricScore` of at least 44 and the explicitly selected `targetVerified`.
The required and declared policies must match, including the planning target.
Removing a declaration cannot disable the catalog requirement. Targets are
authoring goals, not current counts, official exam facts or permission to
weaken review. Unknown weighting remains unknown.

Use the existing strict files in `.github\prompts\`:

1. `generate-gh-three-pass.prompt.md`
2. `verify-gh-technical.prompt.md`
3. `verify-gh-adversarial.prompt.md`

Their names remain unchanged for CLI/Forge compatibility. They apply the
request's credential ID and source policy, not GitHub-only assumptions.
`scripts\generate-questions.ts` already selects these three templates for strict
requests; no AI-specific scaffold or engine is required. A source-approval request
is a request, never approved evidence. Scaffolding creates no questions,
reviewer scores, final attestations or proof of MCP retrieval.

DP-700 and other packages without a strict policy retain their existing legacy
two-pass and ten-criterion 0–2 rules. Do not convert or re-ground DP-700 as part
of an AI expansion.

## Ground each credential independently

Retrieve each credential's own current official Learn study guide, credential
page and linked preparation material through actual Microsoft Learn MCP
(`https://learn.microsoft.com/api/mcp`). Inspect the course and linked self-paced
paths/modules when available. Scheduling is not evidence of general availability.
Verify identity/status separately from whether a current objective map exists;
never treat a future outline as current.

Derive domain names, weights, skills and subskills from the retrieved current
guide. Preserve its actual effective version and actual retrieval clock. Keep
old objective snapshots and compare the complete map, not just its outer label.
The authoritative artifacts are the reviewed catalog evidence, `objectives.json`
and `sources.json`, not a report-generation timestamp or this workflow document.
If retrieval fails or current scope/status cannot be established, report the
limitation honestly and keep the affected work excluded.

AI-103 and AI-200 technical evidence is **Microsoft Learn-only**, with separate
credential-scoped approvals. Build `source-registry.json` using the shared
guide-linked provenance contract:

- The current official guide is a root. Linked official self-paced training
  may originate from the guide or exact official credential page, including the
  observed current-course bridge. A `/en-us/training/courses/` registry record
  uses `sourceClass: "training"` only for the exact
  `credential.officialUrls.training`, parented by the current guide or exact
  credential page. It is ancestry-only, never technical supporting evidence.
- When credential metadata references a course UID and course HTML references
  path UIDs, retain those actual `explicit-reference` receipts and the complete
  credential -> course -> path -> module -> unit graph. Never invent a direct
  credential -> path edge to skip the course.
- Supporting documentation must be directly linked or explicitly referenced by
  the guide or linked self-paced training, never directly by a course overview.
  Training units may follow valid finite training ancestry; documentation cannot
  use an arbitrary doc-to-doc chain. Course records never supply technical
  `validatedSupportingSourceIds`.
- Preserve every ancestor, exact source ID/title/canonical URL, objective
  relevance, actual retrieval/review date, observed link/redirect receipt or
  short explicit reference passage, and the reason it supports this claim.
- Every source must also satisfy this credential's explicit bounded
  `sourceAllowlist`. A shared host, nearby topic, identity URL or another
  credential's approval is insufficient. GitHub Docs is not permitted for these
  AI banks; do not loosen the shared validator or DP-700 policy to admit it.
- Search results may locate documents but are not evidence. Assessments,
  knowledge checks, quizzes, dumps, blogs, videos, forums and internal material
  are neither technical sources nor question templates.

Inspect the actual implementation evidence for each keyed answer and each
distractor, including code, limitations, permissions, prerequisites, deployment
scope, plan/tier and feature availability. Mark documented Preview behavior;
do not infer GA from omission. A guide/credential overview alone cannot support
implementation claims. Preserve original short summaries; raw retrieved
responses stay local in ignored `.grounding\` workspaces.

## Three genuinely distinct contexts

### Pass 1: grounded authoring

Use the approved current objectives and sources to write original, complete,
objective-balanced candidates in small batches. Keep factual content, answers,
explanations, code and citations separate from fantasy narration. Give each
fact/decision a stable `conceptId`; cosmetic variations do not create new facts.
Use the request's count and difficulty mix as planning guidance, not proof of
coverage or difficulty. Prefer applied reasoning when the objective supports it.

Set `verificationStatus: "candidate"` and `requiresManualReview: true`.
Persist the genuine generation record in `validation-metadata.json`, with the
author's identity, observed time, exact question/objective fingerprints and
every option's grounded claim. Do not author either independent review or any
rubric score. Pass the unchanged candidate and its actual evidence to a different
technical review context.

### Pass 2: independent technical review

A second context with a different reviewer identity reads the current guide and
actual approved documents independently. Re-evaluate every option, the complete
multi-select set, uniqueness, explanation, code, feature status, source
relevance, scope and necessary conditions. Re-read sources rather than accepting
the author's key or summaries.

Write a full existing `QuestionReview` under
`validation-metadata.json` at `encounters[id].technical.review`.
Bind `technical.objectiveVersion` and `technical.objectiveFingerprint`
independently. Use actual source snapshots, per-option judgments, checks and
question-specific review notes. A technical `verified` verdict is pass 2 only;
it never authorizes gameplay. Unsupported, ambiguous or insufficiently scoped
items remain rejected/manual-review rather than receiving guessed approvals.

### Pass 3: independent adversarial challenge

A third context and reviewer identity, distinct from both prior contexts, tries
to disprove the key using the actual guide and approved evidence.
For **every option**, including keyed answers, persist a sourced contextual
counterexample analysis in `adversarial.optionChallenges`: `choiceId`,
`claimRepresented`, `whyIncorrectInContext`, `couldBeCorrectWhen`, `sourceIds`
and `evidenceSummary`. Explain why a keyed answer is not incorrect under the
stated conditions. For each distractor, establish the context in which it could
be correct and why that context is absent. If no defensible sourced distinction
exists, reject or request manual review; never invent a favorable condition.

Keep the shared `challenges` field names: scope, plan, role, preconditions,
featureStatus, sourceChanges, stemSufficiency, explanationBounds, reasoningDepth
and answerClues. Apply them to the actual Microsoft product's documented
tenant/subscription/resource/project/service boundaries, plan/tier/edition,
permissions and prerequisites where relevant. Do not import GitHub-specific
repository/organization/enterprise assumptions. Justify nonapplicability
explicitly and check quality/duplicate warnings rather than silently waiving them.

Independently score the existing version-2 rubric from evidence, not by
converting old scores: alignment, accuracy, scenarioCompleteness,
answerUniqueness, distractorPlausibility, distractorEvidence,
documentationStrength, citationSpecificity, difficultyAuthenticity,
explanationQuality, originality and clarityAccessibility.
Each criterion is 0–4. Passing needs total >= the bound minimum (never below
44/48), no zero, accuracy/answerUniqueness/documentationStrength/
citationSpecificity exactly 4, and distractorEvidence >=3.

Persist the adversarial verdict and question-specific notes, the independently
scored encounter rubric, and the actual final package attestation. The final
ledger and rubric use the same adversarial reviewer and actual timestamp.
Every current candidate/status needs an honest independent attestation in the
package's `verification-reviews.json`; no empty placeholder or batch-stamped
approval is acceptable. `reviews:sync` only copies existing matching records
into `src\data\verification-reviews.json`; it cannot create reviews.

## Exact bindings, actual clocks, preserved history

All three passes bind the exact candidate and current objective map/version.
Use the existing `questionFingerprint` and `objectiveFingerprint` helpers only
after the relevant context actually reads that content. Hashes prove binding,
not correctness or independence. A same-version objective edit still changes
its content fingerprint.

Generation follows actual source/objective retrieval. Technical review follows
generation, validation, source reviews and current taxonomy retrieval.
Adversarial review is strictly later than technical review. Capture clocks when
the work actually occurs: never preallocate future stages, backdate reviews or
copy a report timestamp. A repaired authored field restarts all three passes;
updating hashes, dates or outer objective labels alone is not re-review.
Newer source-review snapshots and changed objectives also require independent
re-review. Freshness is relative to checked-in evidence, not a perpetual promise.

Before replacing AI-103's legacy records, preserve their prior question, source,
objective, encounter and review snapshots in version control. Record genuine
objective replacements in the existing `objectiveHistory` structure and retain
the referenced prior map/evidence. Re-evaluate every one of the original 30
records through fresh grounded authoring, technical review and adversarial
challenge; no old verified flag or 18/20 rubric is grandfathered into strict play.
Keep an existing ID when it still represents the same record; assign a new stable
ID to a distinct replacement. Preserve the factual identity of every `conceptId`.
Do not create duplicate current ledger entries as a substitute for history.

AI-200 starts with newly authored candidates and its own evidence/attestation
files, not a clone of AI-103's approvals. Shared concepts or sources still need
credential-specific relevance and duplicate review. Neither package adoption
rewrites, deletes or reinterprets completed local runs, stored answer snapshots,
scores or progress as current mastery.

## Availability and integration

Verified active status and content readiness remain separate requirements.
Beta credentials **remain sealed**, even with freshly verified identity, a
current objective map and fully reviewed questions. Keep the official beta label
and honest sealed warnings; a status correction does not change runtime denial.
This workflow provides no beta opt-in or bypass.

Pending/unverified, unknown, announced, retiring, retired, replaced and
future-map-only credentials also remain sealed. Review completion or an exam
scheduling link cannot substitute for status evidence. Report reviewed
coverage separately from playable coverage; do not promise Study/Boss modes or
future counts. Respect existing thresholds and publish actual shortfalls.

After current evidence, objectives and matching policies are prepared, use the
existing commands, replacing the credential ID to repeat for AI-200:

```powershell
npm run objectives:refresh -- --exam ai-103
npm run questions:generate -- --exam ai-103 --difficulty mix
npm run questions:verify -- --exam ai-103
npm run questions:validate -- --exam ai-103
npm run sources:validate -- --exam ai-103 --online
npm run questions:duplicates -- --exam ai-103 --cross-exam ai-200,dp-700,gh-300,gh-600
npm run questions:coverage -- --exam ai-103
npm run questions:report -- --exam ai-103 --json
npm run content:validate-all
```

Inspect the emitted request before authoring; supply explicit `--count`,
`--target-verified`, `--author` and `--output` values when needed. The generated
request's clock is only its creation time. `objectives:refresh` without
`--candidate` prepares a retrieval request, not refreshed evidence. Before a new
package is installed, supply genuinely grounded candidate `--taxonomy` and
`--package-manifest` paths where the command supports them.

Custom `--questions` inspection is metadata-only and never grants gameplay,
even with a final ledger. Complete strict candidate checks additionally need
`--package-manifest`, `--reviews`, `--encounter-metadata`,
`--validation-metadata`, `--source-registry`, `--manifest` (sources) and
`--taxonomy`. Commit matching package and consolidated attestations together,
preserving nonverified candidates and their reasons. Run normal validation and
inspect duplicate/quality warnings before reporting actual results. Scaffolding,
schema success and URL reachability never substitute for independent review.
