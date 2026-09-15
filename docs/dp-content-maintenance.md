# DP-800 and DP-420 content maintenance

This independent learning experience is not an official GitHub or Microsoft
exam, practice assessment, endorsement, or source of real exam questions.
Encounters are original study questions grounded in publicly available official
documentation.

## Separate current objectives from prospective evidence

DP-800 uses the current
[Developing AI-Enabled Database Solutions guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-800),
explicitly effective **March 12, 2026**. Its current credential name is
**Microsoft Certified: SQL AI Developer Associate**. The package preserves the
three published weight ranges, 11 skills and 73 subskills in
`src/content/exams/dp-800/objectives.json`. Generic hero classes are discovery
filters, not official role requirements.

DP-420's current credential remains
[Azure Cosmos DB Developer Specialty](https://learn.microsoft.com/en-us/credentials/certifications/azure-cosmos-db-developer-specialty/).
On **September 14, 2026**, the
[public study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-420)
supplied a complete outline only for **October 6, 2026**. The credential page
explicitly calls that update upcoming. Its prior-domain change log does not
contain the complete prior weights or subskills. Neither the course nor the
credential page's July 21 update date supplies the missing objective version.

Consequently, DP-420 retains the schema-supported `objectiveVersion: null` and
`isVerified: false` current-map gate. Its visible card and existing personality
remain available for discovery, with both play modes locked. The complete future
outline is stored in
[`dp-420-prospective-objectives.json`](dp-420-prospective-objectives.json),
**outside the gameplay package registry**, alongside
[`dp-420-grounding-status.json`](dp-420-grounding-status.json). It must not be
copied into a current package or treated as current automatically when a calendar
date arrives. Retrieve and independently review the then-current official guide
first. A locked integration is not a completed DP-420 question bank.

## Source approval and three independent contexts

Both catalog records require the existing `three-pass-v1` policy, a **44/48**
minimum twelve-criterion rubric, and a development target of **150 verified
questions per exam**. Those goals are not credential facts or permission to pad.
See the shared [three-pass contract](gh-three-pass-workflow.md),
[source policy](source-policy.md), and
[question maintenance guide](question-bank-maintenance.md).

The DP source allowlists use exact approved URLs, not a blanket official host.
Admit only the current guide, its credential-linked self-paced Learn training,
and technical documentation directly linked or clearly referenced by those
roots. Keep the complete finite provenance graph and real link/redirect receipts.
A locale-neutral Learn training link can be recorded as observed only when its
English canonical path matches exactly. This does not expand canonical technical
source permissions or approve a related page.

Retrieve exact claim-supporting content through Microsoft Learn MCP. Store raw
responses locally in ignored `.grounding` directories; commit original short
summaries, canonical citations, source IDs, objective mappings, and actual
retrieval/curation dates. Do not commit article bodies, secrets, machine-specific
paths, assessments, internal content, or borrowed question banks.

The generic strict prompts are `generate-three-pass.prompt.md`,
`verify-technical.prompt.md`, and `verify-adversarial.prompt.md` under
`.github/prompts`. The request identifies the credential; no other exam's topic
list or personas substitute for its guide.

1. Grounded generation writes original **candidates**, every option's claim
   mapping and contextual evidence, and an exact question/objective-bound
   generation record. It cannot self-author either independent approval.
2. A separate technical context re-derives the key and each distractor from the
   actual sources, checks scope, SQL platform/version, permissions, prerequisites,
   syntax and Preview status, and records a complete technical `QuestionReview`.
3. A third context tries alternate defensible answers and missing conditions,
   records sourced counterexamples for every option, independently scores all
   twelve rubric dimensions, and writes the final verdict and attestation.

Accuracy, answer uniqueness, documentation strength and citation specificity
require **4/4**; distractor evidence requires at least **3/4**; no criterion may
be zero. Authored repairs restart all three passes. Fingerprints bind exact
content; they do not prove correctness or reviewer independence.

Retain original generation, both review passes, exact rejection/manual-review
reasons, and current source snapshots. Only complete, verified, nonstale records
may play. New source reviews or changed objective maps require independent
re-review; preserve historical objective snapshots and completed local sessions.
An unchanged version label does not renew a changed map.

## Commands and readiness

```powershell
npm run objectives:refresh -- --exam dp-800
npm run questions:generate -- --exam dp-800 --target-verified 150 --count 165
npm run questions:verify -- --exam dp-800
npm run questions:validate -- --exam dp-800
npm run sources:validate -- --exam dp-800 --online
npm run questions:duplicates -- --exam dp-800 --cross-exam dp-700,github-copilot,github-agentic-ai-developer,az-104,sc-200,ai-103
npm run questions:coverage -- --exam dp-800
npm run questions:report -- --exam dp-800 --write
npm run reviews:sync
npm run content:validate-all
```

Objective refresh without a candidate map and question generation are requests,
not source retrieval, question generation by a model, or independent review.
`reviews:sync` copies existing matching per-package attestations into the
consolidated ledger; it never creates approvals. Commit both ledgers together.
Run online citation checks separately from factual review.

DP-420 refresh can prepare a retrieval request, but question commands cannot
operate on an invented current taxonomy. Keep the current-map limitation
explicit rather than supplying the prospective file to make a command pass.

The existing minimums remain **25 verified plus all major floors** for Study,
and **75 verified, skill breadth, genuine advanced content, published weighting
and no major gaps** for Boss. Strict Boss readiness additionally requires at
least 40% applied reasoning. Difficulty balance is a reported development goal,
not a reason to inflate labels.

Run exact and near-duplicate diagnostics within and across all installed banks.
Inspect same-fact cosmetic variants, repeated setups, code/choice-order changes,
answer-position skew and construction clues. Pure normalization optimizations do
not change any duplicate threshold. Deterministic findings are not semantic AI;
record actual independent reasoning comparisons and justified cross-exam concept
overlaps without claiming a semantic check that did not occur.

The existing local-storage key and credential IDs remain unchanged. DP-420's
unknown map needs no migration, and prospective evidence never replaces saved
history. Browser fixtures are structural tests, not production verification or
proof that a sealed mode is ready. Report actual counts, coverage, dates, gaps and
executed checks separately from development targets.
