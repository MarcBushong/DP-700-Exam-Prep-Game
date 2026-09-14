# GH-300 and GH-600 three-pass expansion

This independent learning experience is not an official GitHub or Microsoft
exam, practice assessment, endorsement, or source of real exam questions.
Encounters are original study questions grounded in publicly available official
documentation.

## Outcome and limitations

| Exam   | Current candidates | Three-pass verified | Rejected | Manual review | Stale | Playable | Modes                                        |
| ------ | -----------------: | ------------------: | -------: | ------------: | ----: | -------: | -------------------------------------------- |
| GH-300 |                155 |                 149 |        3 |             3 |     0 |      149 | Study and Boss Gauntlet                      |
| GH-600 |                149 |                 136 |       13 |             0 |     0 |        0 | Both sealed: current availability unverified |

There are **285 fully reviewed GitHub questions**, 15 below the combined
300-question development target. Rejected and manual-review records do not
count toward that target. GH-300 is one below its 150 target. GH-600 is 14 below
its target after duplicate and difficulty-quality rejections. No thresholds or
review criteria were lowered, and no filler was inserted.

GH-600's official Learn page offers scheduling, but that does not establish
general availability: beta exams can also be scheduled. The prior beta concern
was not affirmatively resolved by the permitted evidence. Its catalog state is
therefore unverified and its 136 reviewed records remain unavailable to players.
This is an availability restriction, not a claim that those records failed
technical review or that the credential retired.

## Baseline and preservation

The baseline passed lint, TypeScript, all-package/credential/content checks,
449 unit tests, 58 browser tests, and the production build. DP-700 contained
162 verified records, with 54 per domain, difficulty 30 Beginner / 42
Intermediate / 54 Advanced / 36 Expert, and complexity 21 recall / 54
implementation / 22 scenario / 30 troubleshooting / 35 architecture.

DP-700's questions, objectives, sources, existing review ledger, and encounter
metadata remain byte-identical. The existing local-storage key, stable
credential IDs, historical snapshots, exact-set multi-select scoring, selection,
adaptive behavior, and dungeon engine are preserved.

## Architecture and changed files

The packages retain the existing `github-copilot` and
`github-agentic-ai-developer` directories. CLI aliases `gh-300` and `gh-600`
resolve to those IDs without creating duplicate dungeons or splitting saved
progress.

Shared changes add a catalog-bound `three-pass-v1` review policy, strict
guide/training provenance graph, candidate status, version-2 realism rubric,
adversarial metadata, transitive source invalidation, and exam-scoped reports.
Removing a package's strict policy cannot fall back to legacy approval when
the catalog requires it. Legacy DP-700 and other packages retain their existing
review contracts.

The browser loader reads `validation-metadata.json` and `source-registry.json`;
the Forge carries required policies into downloads. The map distinguishes
reviewed-but-unavailable content from playable counts. The About page includes
the disclaimer above. New unit and browser tests cover policy enforcement,
source ancestry, counters, isolation, and sealed access.

Each GitHub package includes its questions, objective map, source manifest,
source registry, all three pass outputs in validation metadata, final
attestations, objective-bound rubric envelopes, coverage reports, verification
report, rejected candidates, and manual-review records. The consolidated
`src\data\verification-reviews.json` contains matching independently authored
reviews for every installed candidate and status.

## Official objectives and status

| Exam   | Current guide                                                                                                                  | Objective version                                                   | Current guide retrieved (UTC) |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------- |
| GH-300 | [GitHub Copilot](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/gh-300)                   | August 7, 2026                                                      | 2026-09-14T13:03:54.506Z      |
| GH-600 | [Developing in Agentic AI Systems](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/gh-600) | Undated published outline, unchanged content snapshot `e6271beb...` | 2026-09-14T13:04:00.402Z      |

GH-300's detailed guide still has six domains, 14 skills, and 41 subskills.
A duplicate features bullet in the at-a-glance list was not interpreted as a
seventh domain.

GH-600's six domains, 19 skills, and 65 subskills are preserved verbatim.
Its undated version retains the prior content hash and labels it as a snapshot,
not an invented effective date. The full version and comparison evidence are in
its `objectives.json`. Neither map changed substantively in this retrieval.

## Approved sources

| Exam   | Guide roots | Linked Learn training | Referenced official Docs | Total approved URLs |
| ------ | ----------: | --------------------: | -----------------------: | ------------------: |
| GH-300 |           1 |                    33 |                       14 |                  48 |
| GH-600 |           1 |                    25 |                       24 |                  50 |

All **98 unique approved URLs** passed final online availability checks.
Sources are restricted to the official Learn study guide, linked self-paced
Learn paths/modules/units, and documentation directly linked or clearly
referenced by those materials. Each source records canonical URL, title,
exam/objectives, class, relevance, parent evidence, retrieval time, and curation
approval time. The graph must terminate at valid guide/training roots; an invalid
ancestor invalidates all dependent reviewed questions.

Principal training roots include
[Copilot fundamentals](https://learn.microsoft.com/en-us/training/paths/copilot/),
[Copilot fundamentals part 2](https://learn.microsoft.com/en-us/training/paths/gh-copilot-2/),
[Foundations of Agentic AI](https://learn.microsoft.com/en-us/training/modules/foundations-agentic-ai/),
[Agent architecture and SDLC integration](https://learn.microsoft.com/en-us/training/modules/design-agent-architecture-integration/),
and [Tooling, MCP, and execution environments](https://learn.microsoft.com/en-us/training/modules/agent-tooling-mcp-execution-environments/).
Direct source lists and parent references are in each package's source registry.

Excluded material includes the disallowed-domain Trust Center link, blocked
Spark redirects, malformed guide links, obsolete numeric retention/usage
claims, and unsupported training snippets. No assessment, dump, community quiz,
blog, video, forum, internal material, or unrelated certification app supplied
question content.

The online checker uses GitHub's official Markdown representation at the same
approved URL for large reference pages. Its 2 MB response cap, timeouts, MIME
checks, error-page rejection, and URL restrictions remain in force.

## Three passes and realism

Pass 1 authors candidates from the approved corpus with evidence for every
option. Pass 2 independently re-derives correctness, context, and source support.
Pass 3 uses a different reviewer to challenge each option with alternate
conditions, scope/plan/role/prerequisite variations, source qualifiers, and
construction and duplicate analysis.

Only after all three agree can a record become verified. Every pass binds the
same question and objective fingerprints, identities must be distinct, and
actual timestamps must follow the prior stage. Source-curation timestamps remain
immutable unless the source snapshot changes. A repair creates a new generation
and requires fresh technical and adversarial passes.

The twelve 0-4 criteria require a total of at least **44/48**, full marks in
accuracy, uniqueness, documentation strength, and citation specificity, at least
3 for distractor evidence, and no zero. The separate overriding rules still
reject a technically correct item with inflated difficulty or same-fact
redundancy. No scores are inferred from field presence or model confidence.

## Coverage by objective

| GH-300 domain                       | Verified questions |
| ----------------------------------- | -----------------: |
| Responsible use                     |                 26 |
| Features                            |                 45 |
| Data and architecture               |                 20 |
| Prompt engineering and context      |                 15 |
| Developer productivity              |                 22 |
| Privacy, exclusions, and safeguards |                 21 |

| GH-600 domain                          | Reviewed questions, unavailable for play |
| -------------------------------------- | ---------------------------------------: |
| Architecture and SDLC                  |                                       16 |
| Tool use and environment interaction   |                                       34 |
| Memory, state, and execution           |                                       23 |
| Evaluation, error analysis, and tuning |                                       22 |
| Multi-agent coordination               |                                       21 |
| Guardrails and accountability          |                                       20 |

GH-300 samples **14/14 skills and 41/41 subskills**. GH-600 samples **19/19 skills
and 59/65 subskills** in its reviewed content. Playable GH-600 coverage remains
zero. Its six reviewed-coverage gaps are pre-action approval; expected outcomes
and operational constraints; multi-agent recovery; nondisruptive agent
replacement; agent retirement with audit continuity; and avoiding approvals that
do not reduce risk. Some gaps remain after duplicate removal; two lifecycle
topics lack sufficiently specific admitted evidence for a responsible candidate.

The authored distribution follows published domain weights where possible,
but source breadth and quality rejection can skew the finite bank. Session
selection separately enforces feasible published weighting and reports
constraints instead of claiming every filtered session is balanced.

## Difficulty, complexity, and answer positions

| Exam            | Beginner | Intermediate | Advanced | Expert | Applied reasoning | Advanced/Expert |
| --------------- | -------: | -----------: | -------: | -----: | ----------------- | --------------- |
| GH-300          |       22 |           68 |       57 |      2 | 137/149 (91.9%)   | 59/149 (39.6%)  |
| GH-600 reviewed |       19 |           61 |       53 |      3 | 130/136 (95.6%)   | 56/136 (41.2%)  |

The intended 15/35/35/15 difficulty mix is a development goal, not a reason to
inflate labels. Expert counts fall short. The 40% applied-reasoning gate counts
non-recall complexity, not Advanced/Expert labels; existing minimum count,
floor/skill breadth, and genuine boss-tier requirements remain separate.

| Exam            | Recall | Implementation | Scenario | Troubleshooting | Architecture |
| --------------- | -----: | -------------: | -------: | --------------: | -----------: |
| GH-300          |     12 |             17 |       88 |              24 |            8 |
| GH-600 reviewed |      6 |             18 |       51 |              36 |           25 |

Question types are GH-300: 61 single-select, 5 multi-select, 78 scenario, 5 code;
GH-600: 16 single-select, 3 multi-select, 117 scenario. No true/false quota was
filled. GH-300 contains code/config interpretation; GH-600's admitted items test
documented operational behavior in scenarios rather than fabricated snippets.

Stored correct-answer positions are GH-300 **41/37/40/36** and GH-600
**47/44/39/9** for positions 1-4. Multi-select counts each correct option.
GH-600 has many valid three-option questions, so fourth-position counts are not
directly comparable. Gameplay shuffles choices while preserving IDs and exact
answer mappings.

## Rejections, manual review, and semantic duplicates

The deterministic final cross-exam scan reports no remaining blocking matches
or decision errors. This does not prove semantic uniqueness. Adversarial review
identified and excluded **15 same-fact/composite duplicates** that survived the
lexical scan: three GH-300 and twelve GH-600 records. One further GH-600 item
(`gh600-a-011`) was rejected because Advanced overstated direct recall.

Current GH-300 rejections: `gh300-a-020`, `gh300-c-001`, `gh300-c-011`.
Current GH-600 rejections: `gh600-a-011`, `gh600-b-020`, `gh600-b-029`,
`gh600-b-031`, `gh600-c-002`, `gh600-c-020`, `gh600-c-021`, `gh600-c-022`,
`gh600-c-023`, `gh600-c-043`, `gh600-c-048`, `gh600-c-051`, `gh600-c-052`.

GH-300 manual-review records remain withheld:

- `gh300-a-038`: PR-input-family concentration.
- `gh300-a-039`: Windows Terminal context overlaps the features-domain scope.
- `gh300-a-040`: excessive concentration on one BYOK facet.

Their technical findings remain reportable, but no adversarial approval was
fabricated. An earlier Expert-labelled `gh300-005` revision was also rejected,
then repaired to Intermediate and rerun through all three fresh passes. Its
original rejection is archived, not counted as a current extra question.
The GH-600 `a-006` idea was withdrawn before final candidate generation and is
not invented into a full reviewed record.

Retained cross-exam concepts require different reasoning and their own objective
mapping. The package verification reports preserve the independent pair
decisions, such as managed MCP organization policy versus project configuration,
SDK per-agent skills versus interactive task context, and durable workflow
artifacts versus conversational context. Different IDs alone are not evidence
of uniqueness.

No promoted question has an unresolved unsupported-claim or citation finding.
Current rejections are redundancy or difficulty decisions rather than a claim
that every discarded item was factually false. Source omissions and exclusions
are separately disclosed. Nonblocking wording heuristics remain visible for
editorial inspection.

## Actual grounding and review dates

| Snapshot                                | GH-300 (UTC)             | GH-600 (UTC)                           |
| --------------------------------------- | ------------------------ | -------------------------------------- |
| Latest initial source retrieval         | 2026-09-14T13:12:53.977Z | 2026-09-14T13:12:13.429Z               |
| Source-curation approval                | 2026-09-14T13:22:40.643Z | 2026-09-14T13:24:06.056Z–13:24:06.199Z |
| Latest successful final question review | 2026-09-14T15:20:47.344Z | 2026-09-14T16:29:25.121Z               |

Adversarial reviewers also recorded fresh same-URL checks of critical evidence.
Those checks did not silently replace central source snapshots or reuse an old
approval after changed content. The exact dates, reviewers, counterexamples,
rubric scores, and stage history are stored in the packages.

## Commands actually executed

| Check                                                                                                                | Result                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Baseline lint/typecheck/tests/build/browser/content checks                                                           | Passed                                                                        |
| Final lint and TypeScript                                                                                            | Passed                                                                        |
| Final unit suite                                                                                                     | 585 passed, 30 files, zero skipped                                            |
| Full browser suite                                                                                                   | 60 passed, zero skipped                                                       |
| Production build                                                                                                     | Passed; nonblocking static-bundle-size warning retained                       |
| `credentials:validate`, `content:validate-all`, `content:status`                                                     | Passed                                                                        |
| `questions:validate`, `questions:verify`, `questions:duplicates`, `questions:coverage`, `questions:report`, per exam | Passed                                                                        |
| Cross-exam duplicate command for GH-300/GH-600/DP-700                                                                | Passed; semantic exclusions remain recorded                                   |
| `sources:validate --online`, both exams                                                                              | Passed; 48 + 50 URLs                                                          |
| `objectives:refresh --exam gh-300` and `--exam gh-600`                                                               | Passed as disclosed refresh requests, not automatic retrieval/promotion       |
| `questions:generate --target-verified 150`, both exams                                                               | Passed as disclosed maintainer scaffolding, not AI generation or verification |
| `reviews:sync` and final ledger agreement                                                                            | Passed; only existing attestations copied                                     |

The standard coverage command reports the honest one- and fourteen-question
shortfalls; a successful diagnostic command is not a claim that the numeric
targets were met. GH-600's requested live boss-tier journey cannot run while
availability is unverified, so browser tests assert its disabled card and
rejection of an imported gauntlet configuration instead of bypassing the gate.
GH-300 study, source links, per-distractor explanations, isolated history, and
the DP-700 regression journey execute normally.

See [the maintained workflow](gh-three-pass-workflow.md), each package's
`question-bank-report.json` and `verification-report.json`, and its
`rejected-candidates.json` / `manual-review.json` for the complete audit.
