# Question-bank maintenance

This is original, unofficial DP-700 practice material, **not a Microsoft practice exam**. The browser reads a versioned, build-time-grounded bank. It makes no AI or telemetry requests and needs no API key. Generation is a maintainer/Copilot workflow; the deterministic CLI only scaffolds work and validates recorded evidence.

## Evidence and dates

The expansion's actual primary Microsoft Learn MCP fetches were:

| Page                                                                                                                           | Actual retrieval (UTC)   |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| [DP-700 study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)               | 2026-09-11T17:31:25.095Z |
| [Fabric Data Engineer Associate](https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/) | 2026-09-11T17:31:26.955Z |
| [DP-700 course](https://learn.microsoft.com/en-us/training/courses/dp-700t00)                                                  | 2026-09-11T17:31:29.418Z |

The guide is effective **July 21, 2026** (3 domains, 10 skills, 54 subskills). Raw responses are local, ignored `.grounding\expansion\{guide,certification,course}.json` evidence. The current committed manifest and generated report—not this workflow document—record the bank's exact latest grounding, source review, and verification dates. A report's creation timestamp is never a verification timestamp.

Study-guide scope and weighting are authoritative. Product articles verify behavior. Context pages, search hits, and URL reachability alone do not verify answers. Never open knowledge checks/practice assessments for authoring, copy question banks, or manufacture a successful MCP response.

Direct English Microsoft Learn Power BI product articles (`/en-us/power-bi/`) are permitted alongside the existing product prefixes when aligned with the current objective. The same HTTPS host, query-string, encoded-path, and assessment exclusions apply; this does not permit other Power BI domains or arbitrary pages.

Stored citations remain query-free. During online checks only, the validator
also accepts the observed canonical Kusto `view=microsoft-fabric` and T-SQL
`view=sql-server-ver17` redirects on their respective official Learn paths.
Additional query parameters and redirects to other hosts remain rejected.

## Start a batch (PowerShell)

Use a unique directory and request ID. Scaffolding refuses to overwrite a workspace and does **not** generate questions or claim evidence was retrieved.

```powershell
npm run questions:generate -- --id batch-001 --author maintainer-name --count 6 --output .grounding\batch-001
npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700" .grounding\batch-001\study-guide.json
npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/" .grounding\batch-001\certification.json
npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/training/courses/dp-700t00" .grounding\batch-001\course.json
npm run grounding:taxonomy -- .grounding\batch-001\study-guide.json .grounding\batch-001\objectives.candidate.json
npm run grounding:retrieve -- search "Microsoft Fabric specific implementation behavior" .grounding\batch-001\search.json
npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/fabric/security/security-overview" .grounding\batch-001\security.json
```

Replace the example supporting article with direct pages for the actual scenario. Inspect current documentation, including constraints, alternatives, terminology, and Preview status. Review candidate taxonomy changes before replacing `src\data\objectives.json`; never change objectives to disguise gaps. Refresh affected source records using true retrieval/review dates.

In Copilot, use `.github\prompts\generate-dp700-questions.prompt.md` with the batch's `request.json`. Narrow objective targets, populate evidence references, and author `generation-output.json` matching the output schema. Every generated candidate remains `manual-review-required`. The script does not invoke a model or require a paid service.

Extract the candidate array for standalone validators and prepare a candidate source manifest containing the sources it cites:

```powershell
$output = Get-Content .grounding\batch-001\generation-output.json -Raw | ConvertFrom-Json
ConvertTo-Json -InputObject @($output.candidates) -Depth 100 | Set-Content .grounding\batch-001\candidates.json -Encoding utf8
Copy-Item src\data\grounding-manifest.json .grounding\batch-001\manifest.json
```

Add genuinely reviewed supporting records to the candidate manifest; do not silently overwrite existing source evidence. Raw responses remain local. Commit original short summaries, citations, reviewed questions, and final manifests—not retrieved article bodies.

## Two distinct passes

**Pass 1 — authoring grounding:** derive original stems, code, alternatives, and explanations from retrieved implementation documentation. Map each question to exactly one current domain/skill/subskill; assign a stable `conceptId` for the technical fact/decision. Questions about the same fact share that ID, even when reworded.

**Pass 2 — independent verification:** a different person or separate reviewer context uses `.github\prompts\verify-dp700-questions.prompt.md` to inspect the completed item against the cited documents. Check every correct answer, every distractor, explanation, limitation, prerequisite, code operation, source applicability, and feature status. A wordy scenario is not automatically Expert. Ambiguous or unsupported questions stay excluded.

The reviewer writes question-specific notes and a qualitative `confidenceReason`, not an invented probability. Machine-readable `reviews.json` binds a separate author/reviewer declaration, exact content SHA-256, per-option judgments, source snapshots, and all checklist results. Final independently authored attestations are committed in `src\data\verification-reviews.json`, covering **every candidate, including nonverified statuses**. The validator checks the declaration's consistency; it cannot authenticate people or prove independent thought.

```powershell
npm run questions:validate -- --questions .grounding\batch-001\candidates.json --manifest .grounding\batch-001\manifest.json --taxonomy .grounding\batch-001\objectives.candidate.json
npm run questions:duplicates -- --questions .grounding\batch-001\candidates.json --manifest .grounding\batch-001\manifest.json --taxonomy .grounding\batch-001\objectives.candidate.json
npm run questions:verify -- --questions .grounding\batch-001\candidates.json --manifest .grounding\batch-001\manifest.json --taxonomy .grounding\batch-001\objectives.candidate.json
```

The last command prints fingerprints, statuses, and failures; it changes **nothing**. After the actual independent review, the maintainer manually applies its verdict and metadata to candidate records and checks the review file:

```powershell
npm run questions:verify -- --questions .grounding\batch-001\candidates.json --manifest .grounding\batch-001\manifest.json --taxonomy .grounding\batch-001\objectives.candidate.json --reviews .grounding\batch-001\reviews.json
```

Default `questions:verify` requires the committed `src\data\verification-reviews.json` ledger and fails if it is missing or mismatched. Every candidate in the selected bank, regardless of status, needs exactly one matching attestation; extra/unknown or duplicate entries fail. Verification notes and confidence reasons must match the candidate for every status; verified records additionally match the review timestamp. Changing substantive content or its generation/validation dates invalidates its fingerprint. The build runs this gate immediately after structural validation.

For authoring, an explicit `--questions` without `--reviews` intentionally runs **metadata-only** mode and prints fingerprints; it does not claim attestations were checked. Add `--reviews` to validate the batch's independently authored review file. The output exposes `mode`, `reviewFile`, and `attestationChecksPassed`; missing or invalid required files report errors and exit nonzero. No command promotes or rewrites verification metadata.

## Verification contract and freshness

- `verified`: nonempty concept ID, notes/reason, actual `verifiedAt`, exact reviewed source-ID set, `requiresManualReview: false`, and a `sourceLastReviewedAt` equal to the latest cited manifest review. Verification must not predate generation, validation, or any cited source review.
- `manual-review-required`, `rejected`, `stale`: retained candidates, excluded from play and available coverage. Dates may be absent; never invent missing dates.
- Legacy saved questions without metadata parse as `manual-review-required`, never auto-verified. Existing historical scores remain usable.
- **Change-driven freshness:** a cited source review newer than the question's reviewed snapshot downgrades it to effective `stale`. Staleness is calculated without rewriting JSON. A future/impossible timestamp is an error. A more recent retrieval must be followed by a real source review; it cannot preserve an earlier review date.
- No arbitrary calendar expiry is imposed. “Fresh” means consistent with the currently checked-in evidence, not “always up to date.” Re-fetch when the guide, behavior, source availability, prerequisites, or feature status changes. Review relevant records on every content update. Updating taxonomy objectives requires checking all mappings.

`validateContent` validates schemas, mappings, citations, chronology, and blocking duplicates. Its `questions` array contains only playable verified records; `allQuestions` retains schema-valid candidates with effective stale status. `inspectContent` collects per-question errors for reports. `isPlayableQuestion` is the final status/metadata guard for selection, including retries. These are structural safeguards, not semantic proof.

## Duplicate and quality review

Blocking checks normalize case, Unicode, whitespace, punctuation, option ordering, and code tokens while retaining operators/literals. Identical stems with equivalent code and high-overlap stems with matching options are blocked. Superficially renamed code paired with a matching scenario/choices is blocked. Distinct concept IDs do not bypass these checks.

Moderate lexical overlap, shared `conceptId` facts, and less-certain code similarities are review warnings, not assertions of semantic identity. Remove/rewrite true duplicates; assess legitimate variants in the independent review. There is no automatic blocking-issue waiver for verified entries.

Quality warnings identify long scenarios, unusual answer-length cues, skewed original answer positions, repeated openings, negative/absolute wording, pronoun references, short applied scenarios, grammar cues, and conspicuous distractors. An independent reviewer must assess plausibility, omitted constraints, and whether more than one answer is defensible. Gameplay safely shuffles choices; reports show original answer positions (multi-select counts every key). The interface displays the required multi-select count.

## Commands and reports

All validation commands work without Copilot. Optional `--questions`, `--manifest`, and `--taxonomy` select candidate JSON paths; defaults are the versioned bank.

| Command                                                                     | Meaning                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run questions:generate`                                                | Scaffold request/review files and reusable prompts; no AI invocation                              |
| `npm run questions:generate -- --schemas-only`                              | Regenerate `schemas\*.schema.json` from existing Zod definitions                                  |
| `npm run questions:validate`                                                | Fail on malformed records, citations, mapping, chronology, or blockers affecting verified records |
| `npm run questions:coverage`                                                | Playable-only coverage, all status counts, targets, and gaps                                      |
| `npm run questions:coverage -- --strict`                                    | Additionally require 150 playable, >=40% Advanced/Expert, and all subskills sampled               |
| `npm run questions:duplicates`                                              | Blocking duplicate errors plus conservative editorial warnings; blockers fail                     |
| `npm run questions:verify`                                                  | Require the committed independent-review ledger and check every candidate plus embedded metadata  |
| `npm run questions:verify -- --strict`                                      | Additionally fail if any record is excluded                                                       |
| `npm run questions:verify -- --reviews path\reviews.json`                   | Check independent attestations against exact candidate and source snapshots                       |
| `npm run questions:verify -- --questions path\candidates.json`              | Explicit metadata-only authoring mode; no independent-attestation check                           |
| `npm run questions:report`                                                  | Print readable Markdown diagnostics                                                               |
| `npm run questions:report -- --json`                                        | Print machine-readable report                                                                     |
| `npm run questions:report -- --write`                                       | Write `docs\content-coverage.md` and `docs\question-bank-report.json`                             |
| `npm run questions:report -- --write --output .grounding\batch-001\reports` | Persist both report formats for a candidate batch                                                 |
| `npm run validate:sources -- --online`                                      | Separate allowlisted, bounded URL availability checks                                             |

Legacy `validate` and `content:report` remain aliases. All errors/blockers appear in diagnostics; quality warnings are not semantic verdicts. Coverage/verification are not quota gates unless `--strict` is supplied, so honest pending candidates and gaps can remain visible. Reports preserve all four effective statuses, malformed-record counts, playable-only counts by domain/skill/subskill/difficulty/complexity/type/source, multiple citations, findings, gaps, answer positions, and real evidence dates.

JSON Schemas describe machine-readable shape. Shared TypeScript/Zod validation additionally enforces cross-field relationships; passing JSON Schema alone is insufficient.

## Before integrating a reviewed batch

Merge only reviewed records with stable IDs, preserve truthful metadata, remove blocking duplicates, and retain rejected/pending entries only when useful for future review. Then:

```powershell
npm run questions:validate
npm run validate:sources
npm run validate:sources -- --online
npm run questions:coverage
npm run questions:duplicates
npm run questions:verify
npm run questions:report -- --write
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Inspect and commit both report formats after successful review. Record gaps honestly; never lower evidence quality to reach a count. Tenant execution is not part of this workflow and requires separate authorization.
