# Certification Dungeon implementation report

This revision evolves the existing browser app rather than replacing it. All
counts below describe checked-in study content, not vendor exam frequency,
official scoring, or a prediction that a learner will pass.

## Architecture and changed surfaces

The shared engine now loads credential packages from `src\content\exams\<id>`.
Each package has its own manifest, objective map, questions, source manifest,
independent-review ledger, claim/rubric envelopes, personality extension, and
coverage reports. Catalog and public hero-class mappings are data under
`src\content\credentials`.

The map, Tavern, Forge, setup, play, result/review screens, source drawer,
styles, and original castle artwork implement the dungeon presentation.
Credential-aware session origins, objective snapshots, isolated histories,
balanced raids, guarded gauntlets, safe exports, and local-data migration remain
shared services. Fantasy narration never changes factual question fields.

Maintainer scripts, JSON schemas, prompts, CI, unit/browser tests, and
documentation cover discovery, readiness, source policies, verification,
duplicate review, realism, lifecycle, and reporting. The consolidated
`src\data\verification-reviews.json` contains exact copies of the independently
authored package attestations, not a second question bank.

An integration review identified an objective-version relabeling gap. Independent
rubrics now bind the actual objective-map fingerprint and version, with review
chronology checks. Relabeling the outer package cannot reopen an old review.

## Open dungeons and encounter status

| Dungeon                 | Credential              | Verified | Manual review | Rejected | Stale | Modes                   |
| ----------------------- | ----------------------- | -------: | ------------: | -------: | ----: | ----------------------- |
| The Fabric Depths       | DP-700                  |      162 |             0 |        0 |     0 | Study and Boss Gauntlet |
| The Infrastructure Keep | AZ-104                  |       30 |             0 |        0 |     0 | Study; gauntlet locked  |
| The Sentinel Watch      | SC-200                  |       30 |             0 |        0 |     0 | Study; gauntlet locked  |
| The AI Workshop         | AI-103                  |       30 |             0 |        0 |     0 | Study; gauntlet locked  |
| The Copilot Spire       | GH-300 / GitHub Copilot |       30 |             0 |        0 |     0 | Study; gauntlet locked  |
| **Total**               | **5 open dungeons**     |  **282** |         **0** |    **0** | **0** |                         |

The existing 162-question DP-700 bank is preserved, with 120 newly reviewed
encounters across four representative areas. The smaller packages meet the
25-question Study threshold and cover every major floor, but do not meet the
75-question and per-skill breadth gates for Boss Gauntlets.

## Coverage and difficulty

Floor counts follow each package's published objective order; the linked reports
show the exact titles, weights, and all individual skill/subskill counts.

| Package report                                                            | Questions per floor                        | Beginner | Intermediate | Advanced | Expert | Skills sampled | Subskills sampled |
| ------------------------------------------------------------------------- | ------------------------------------------ | -------: | -----------: | -------: | -----: | -------------- | ----------------- |
| [DP-700](../src/content/exams/dp-700/content-coverage.md)                 | 54 / 54 / 54                               |       30 |           42 |       54 |     36 | 10/10          | 54/54             |
| [AZ-104](../src/content/exams/az-104/content-coverage.md)                 | 7 / 6 / 8 / 5 / 4                          |        6 |            9 |       10 |      5 | 15/15          | 27/82             |
| [SC-200](../src/content/exams/sc-200/content-coverage.md)                 | 13 / 10 / 7                                |        6 |            9 |       11 |      4 | 8/9            | 13/54             |
| [AI-103](../src/content/exams/ai-103/content-coverage.md)                 | 8 / 10 / 4 / 4 / 4                         |        6 |            9 |       10 |      5 | 13/14          | 21/64             |
| [GitHub Copilot](../src/content/exams/github-copilot/content-coverage.md) | 5 / 9 / 4 / 4 / 4 / 4                      |        6 |            9 |       11 |      4 | 14/14          | 25/41             |
| **Total**                                                                 | **Every major floor in each open dungeon** |   **54** |       **78** |   **96** | **54** | **60/62**      | **140/295**       |

Advanced/Expert encounters comprise **150/282 (53.2%)**. Sampling a floor is not
exhaustive coverage. The four newer packages have **155 unsampled subskills**;
their reports disclose the gaps, rather than filling them with unverified
questions. SC-200 and AI-103 each also have one unsampled skill.

## Credential discovery and sealed doors

All 18 requested identifiers have reviewed identity/status evidence in the
catalog. Fifteen have verified active identities and current maps. Five are open;
the following ten active mapped credentials have no encounter bank yet:

| Identifier | Reviewed public credential name                |
| ---------- | ---------------------------------------------- |
| AZ-120     | Azure for SAP Workloads Specialty              |
| AZ-305     | Azure Solutions Architect Expert               |
| AZ-700     | Azure Network Engineer Associate               |
| DP-800     | SQL AI Developer Associate                     |
| AI-200     | Azure AI Cloud Developer Associate             |
| AI-300     | Machine Learning Operations Engineer Associate |
| AI-901     | Azure AI Fundamentals                          |
| SC-500     | Cloud and AI Security Engineer Associate       |
| AZ-400     | DevOps Engineer Expert                         |
| GH-500     | GitHub Advanced Security                       |

Three additional doors remain sealed for lifecycle or evidence reasons:

- **AZ-800:** the exam is retiring September 30, 2026. This does not assert that the whole Windows Server Hybrid Administrator credential retires.
- **DP-420:** official registration is offered, but the captured guide contains a future October 6, 2026 outline. The required current map is unverified; no future outline is treated as current.
- **GH-600 / GitHub Agentic AI Developer:** the official exam record is beta. Conflicting credential-level and exam-level flags are documented rather than silently resolved in favor of general availability.

No mapped credential is labelled retired without evidence. Undated published
outlines have explicitly labelled retrieval/hash versions, not invented
effective dates. The [catalog](../src/content/credentials/credentials.json)
contains direct official links, actual evidence retrieval times, review times,
and reasons for each sealed state.

## Hero classes

All **13 generic classes** are config-driven, many-to-many discovery filters.
There are no internal role names, required credential bundles, or employer
prerequisites. See [hero-class mappings](hero-classes.md) and
[`hero-classes.json`](../src/content/credentials/hero-classes.json).

## Sources and verification

The five packages contain **189 source records referencing 182 unique official
URLs**. Microsoft identity, scope, preparation, and product evidence was retrieved
through actual Microsoft Learn MCP. GitHub product evidence comes from
`docs.github.com`; official GitHub catalog responses and corroborating Learn
guides establish identity and competency scope separately.

All 182 unique URLs passed bounded online availability checks; all per-package
source-policy and citation checks passed. Availability is not proof of answer
correctness. Each playable encounter has a separate author/reviewer assessment
of every option, a matching content fingerprint, and an independently scored
objective-bound realism rubric.

Latest product-bank grounding in this revision:
**2026-09-11T19:36:56.258Z**. Per-package source and review timestamps remain in
the actual records; the catalog has its own identity/outline review dates.
These are versioned evidence snapshots, not an always-current claim.

| Package        | Last bank grounding (UTC) | Latest answer-review finalization (UTC) | Objective/rubric finalization (UTC) |
| -------------- | ------------------------- | --------------------------------------- | ----------------------------------- |
| DP-700         | 2026-09-11T17:57:55.860Z  | 2026-09-11T18:30:09.514Z                | 2026-09-11T20:46:03.576Z            |
| AZ-104         | 2026-09-11T19:34:46.598Z  | 2026-09-11T20:11:35.023Z                | 2026-09-11T20:44:42.051Z            |
| SC-200         | 2026-09-11T19:36:56.258Z  | 2026-09-11T19:59:59.756Z                | 2026-09-11T20:45:24.667Z            |
| AI-103         | 2026-09-11T19:24:51.018Z  | 2026-09-11T20:11:23.540Z                | 2026-09-11T20:45:14.915Z            |
| GitHub Copilot | 2026-09-11T19:22:39.103Z  | 2026-09-11T21:02:43.031Z                | 2026-09-11T21:02:43.031Z            |

There are **zero blocking duplicates and zero citation errors**. Cross-package
IDs are unique. The reports retain **233 nonblocking editorial warnings**
(including wording and answer-length heuristics) that reviewers assessed
against the evidence; they are not unverified questions.

## Dungeon Master catalog

**278 original lines** comprise 242 shared messages and 36 dungeon-specific boss
extensions. The catalog has **29 categories and 16 themes**.

| Main category                 |                                 Lines |
| ----------------------------- | ------------------------------------: |
| Correct / incorrect           |                               35 each |
| Streak / timeout              |                               15 each |
| Session completion            |                                    20 |
| Documentation / weak practice |                               10 each |
| Boss intro / boss defeat      | 21 each, including package extensions |

Other categories cover partial answers, unanswered encounters, recovery,
repeated mistakes, score bands, boss loss, floor clearing, cursed chambers, tome
opening, and return visits. Themes include infrastructure, networking,
architecture, security, data, Fabric, Cosmos DB, AI, MLOps, DevOps, GitHub
Copilot, GitHub Advanced Security, SAP, Windows Server, documentation, and
cross-dungeon play. See [personality authoring](personality-authoring.md) for
matching, repetition controls, seeded testing, and chattiness rules.

## Remaining scope

The 13 sealed catalog entries need a current eligible map where missing and
independently reviewed content before they can open. The four 30-question
packages need additional breadth and volume before gauntlets unlock.
PWA/offline installation is not implemented; loading the hosted app requires
internet. All completed results remain local, and no runtime AI service is required.

## Validation outcome

Lint and TypeScript checks pass. The complete unit suite passes **449 tests**,
and the final desktop/mobile browser run passes **58 tests**, including class
selection, a hard study run, tome evidence, nonrepeating narration, cursed
chambers, another dungeon, mixed-dungeon raid origins, and sealed-door gates.
Keyboard, reduced-motion, and forced-color accessibility checks also pass.

The production build, credential validation, all-package content validation,
content status, all five exam-scoped question commands, online source checks,
and Forge/discovery/objective-refresh scaffolding commands were executed
successfully. The build retains a nonblocking bundle-size warning; no threshold
was raised to hide it. URL checks and schema checks are not substituted for the
separate content reviews.
