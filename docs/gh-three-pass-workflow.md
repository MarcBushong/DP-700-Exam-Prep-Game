# GH three-pass content workflow

This independent learning experience is not an official GitHub or Microsoft
exam, practice assessment, endorsement, or source of real exam questions.
Encounters are original study questions grounded in publicly available official
documentation.

## Opt-in without migration

Canonical package/storage IDs remain `github-copilot` (GH-300) and
`github-agentic-ai-developer` (GH-600). CLI `--exam gh-300`, `GH-300`, `gh-600`
and `GH-600` resolve to those existing IDs. No second engine or storage migration.
Packages without a strict opt-in retain the unchanged legacy two-pass and ten-criterion 0–2
rubric. Missing legacy question metadata defaults to manual review.

DP-800 and DP-420 also opt into this same strict profile. Their generic
credential-scoped prompts do not import GitHub-specific subjects or personas.
See [DP content maintenance](dp-content-maintenance.md) for current objective
versions, source restrictions, and DP-420's separately preserved prospective map.
The legacy profile remains unchanged for packages that do not opt in.

Strict packages explicitly declare this in their existing `manifest.json`:

```json
{
  "reviewPolicy": {
    "version": "three-pass-v1",
    "minimumRubricScore": 44,
    "targetVerified": 150,
    "sourcePolicy": "guide-linked-official"
  }
}
```

This is content-development policy, not an official exam fact. The threshold
may rise to 48, never drop below 44. Target is 150 verified **each**, not exam
codes interpreted as counts. Ship fewer rather than weaken review.

The catalog independently pins the required profile with
`credential.requiredReviewPolicy`, containing the **same complete object** as
the package `reviewPolicy`. Parent integration sets this on both canonical GH
catalog entries. The package declaration must match every field exactly.
Removing or altering its policy causes a global `review-policy-binding`
failure; removing validation metadata or provenance still fails strict checks
because the catalog requirement activates them independently of package flags.
Reports show required, declared and effective policies separately. Other
catalog entries omit this field and retain their legacy validation behavior.

## Ground, author, technically verify, adversarially challenge

1. Actually retrieve the current official Learn guide, credential and linked
   self-paced training through Microsoft Learn MCP. Preserve effective
   objective version and actual retrieval dates. Parse published objectives,
   subskills and weight ranges; unknown weighting remains unknown.
2. Curate `source-registry.json` under the [strict source policy](source-policy.md).
   Failures skip dependent candidates; neither MCP nor a scaffolder is a
   question-generation model.
3. Follow `generate-gh-three-pass.prompt.md` in an authoring context. Write
   complete original candidates and every option's evidence; status `candidate`.
   Record generation output, identity, time and exact content/objective hashes.
4. A different context follows `verify-gh-technical.prompt.md`, re-evaluating all
   claims independently. Persist a full existing `QuestionReview` in
   `validation-metadata.json` at `encounters[id].technical.review`, plus the
   technical objectiveVersion/objectiveFingerprint. Pass 2 is NOT gameplay.
5. A third distinct context follows `verify-gh-adversarial.prompt.md`. Persist
   sourced counterexamples for **every** option and all scope/plan/role,
   prerequisites, status, source changes, sufficiency, explanation, difficulty
   and answer-clue challenges. The `adversarial` stage contains reviewer, date,
   verdict, exact hashes, `optionChallenges`, `challenges` and `qualityNotes`.
6. Write the actual final independent attestation to the package
   `verification-reviews.json` and commit matching entries in the existing
   consolidated `src/data/verification-reviews.json`. Every status requires
   an actual attestation, not an empty placeholder or generated pass.

Machine-readable definitions are `schemas/validation-metadata.schema.json`,
`source-registry.schema.json`, `encounter-metadata.schema.json` and
`verification-review.schema.json`; TypeScript cross-field refinements remain
authoritative. The canonical browser-safe exports live in
`src/features/dungeons/{threePass,provenance,review,schema}.ts`.

All three passes bind the exact question and current objective hashes.
Generation must follow source/objective retrieval; technical review follows
generation, validation, current objective retrieval and source reviews;
adversarial review is strictly later than technical review. The final ledger
and rubric share the adversarial reviewer/date. A rewrite invalidates **all**
stages, never automatically renews hashes. Newer source review snapshots and
changed objective maps require independent re-review. Freshness is relative to
checked-in evidence, not an “always current” promise.

## Strict realism rubric

Set `rubric.version: 2` on the existing encounter envelope. Score 0–4:
alignment, accuracy, scenarioCompleteness, answerUniqueness,
distractorPlausibility, distractorEvidence, documentationStrength,
citationSpecificity, difficultyAuthenticity, explanationQuality, originality,
clarityAccessibility. Passing requires no zero, accuracy/answerUniqueness/
documentationStrength/citationSpecificity exactly 4, distractorEvidence >=3,
and total >= manifest minimum (44/48 by default). No old-score conversion.
Keep the existing independent objectiveVersion/Fingerprint bindings, real
reviewer/date and question-specific notes.

Complete valid nonverified records remain reportable in `questions.json`.
Incomplete malformed records belong in rejected/manual-review authoring files,
not gameplay. Missing later passes on a nonverified record are queue items.
No raw verified status bypasses either pass, evidence, rubric or readiness.
Quarantine warnings do not globally fail an otherwise valid package.

## Commands

```powershell
npm run objectives:refresh -- --exam gh-300
npm run questions:generate -- --exam GH-300 --target-verified 150 --count 180 --difficulty mix
npm run questions:generate -- --exam gh-600 --target-verified 150 --count 180 --difficulty mix
npm run questions:verify -- --exam gh-300
npm run questions:validate -- --exam gh-300
npm run sources:validate -- --exam gh-300 --online
npm run questions:duplicates -- --exam gh-300 --cross-exam gh-600,dp-700
npm run questions:coverage -- --exam gh-300
npm run questions:report -- --exam gh-300 --json
npm run content:validate-all
```

Repeat scoped validation/report commands for GH-600. `objectives:refresh` without
`--candidate` writes a retrieval request, not evidence. Generation creates a
source-approval request and three prompts, not questions or reviews.
`--count` is the candidate planning goal; `--target-verified` is separate.
Mixed planning is 15/35/35/15 across beginner/intermediate/advanced/expert;
“Foundational” is a planning label for the existing beginner enum. Aim for at
least 40% applied reasoning when supported. Requests can select an explicit
difficulty list or percentages without inventing coverage.

`--questions <custom-file>` remains metadata-only authoring (zero gameplay
authorization), even with a supplied final `--reviews`. For a complete custom
strict-package check also supply `--package-manifest`, `--reviews`,
`--encounter-metadata`, `--validation-metadata`, `--source-registry`,
`--manifest` (sources) and `--taxonomy`. Committed package verification always
requires package and consolidated ledgers; custom inspection does not replace it.
For partial source curation, `--questions`, `--manifest`, `--taxonomy` and
`--source-registry` additionally check strict recorded provenance without
requiring later-pass metadata or authorizing gameplay.

Cross-exam lexical/code/entity/choice-order checks produce editorial warnings,
not purported semantic AI. `--semantic-reviews <file>` records independently
reviewed keep-distinct/reject/manual decisions using
`schemas/semantic-review.schema.json`, exact question/objective fingerprints,
reviewer/date and a meaningful reasoning distinction. Same-concept cross-exam
items without a current decision stay flagged. Global ID collisions remain
blocking. Operator differences (`>`/`>=`, template `@{}`) are not cosmetic.

Reports show statuses, pass failures, provenance violations, all twelve score
distributions, concept reuse, answer positions, applied reasoning, reviewed
versus playable coverage and the target shortfall. Study still requires >=25
verified and all major domains; Boss >=75, skill breadth, meaningful reviewed
Advanced/Expert content and published weighting when available. A Beta card
remains sealed even with fully reviewed questions; reviewed count is not
playable count. Report creation is never a source retrieval or validation date.

For strict GitHub packages, the 40% applied-reasoning check counts reviewed
questions whose complexity is not `concept-recall`. It is not the percentage
labelled Advanced or Expert. Difficulty balance remains a reported editorial
target, while the existing requirement for genuine boss-tier encounters still
applies. Never inflate difficulty labels or lower review thresholds to unlock a mode.

For example, a sealed Beta package may contain 150 fully reviewed questions,
have `reviewedQuestionShortfall: 0`, and still expose **zero** playable coverage
with both modes locked. Catalog `verifiedQuestionCount` retains its playable
convention (zero). Coverage, verification and all-package reports separately
show total candidate records, reviewed counts/coverage, availability reasons
and playable counts/coverage. Scheduling an exam does not establish GA.
`--strict` coverage/verification checks of playable availability intentionally
fail for a sealed package; default structural review does not mislabel its
reviewed content as unauthored.

All evidence, generated data and study progress stay local. No external model
API, paid generation runtime, telemetry, unsafe HTML or arbitrary URL proxy.
