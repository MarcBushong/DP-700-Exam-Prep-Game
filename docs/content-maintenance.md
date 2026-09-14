# Maintaining grounded practice content

This bank is independent, original practice material, not an official Microsoft exam or a collection of exam questions. Never use dumps, remembered exam content, copied assessments, or large documentation excerpts.

Last successful online URL validation: 2026-09-14T21:18:14.374Z (95 unique URLs; 0 identity context URLs not checked).

## Source of truth and evidence

The Microsoft Learn DP-700 study guide retrieved through the Learn MCP endpoint is authoritative for the objective taxonomy. The expansion's refreshed snapshot is effective **July 21, 2026**, retrieved **2026-09-11T17:31:25.095Z**. It contains three domains, ten skills, and 54 subskills. Do not hand-edit objectives to make coverage look complete.

The certification and instructor-led course pages were retrieved for context, but dynamic skill sections returned “Loading” placeholders. The self-paced **Manage a Microsoft Fabric environment** path and relevant CI/CD and monitoring modules were separately retrieved. Only instructional learning units were followed; assessment and knowledge-check pages were not opened.

## Review workflow

The complete two-pass workflow, machine-readable schemas, independent-review
attestations, freshness policy, candidate-path commands, and JSON/Markdown
reports are documented in [Question-bank maintenance](question-bank-maintenance.md).
Use the reusable generation and verification prompts in `.github/prompts`.
The `questions:generate` command scaffolds a local review workspace; it does
not call a generation service, retrieve evidence, or mark anything verified.

1. Run `npm run grounding:retrieve -- search "specific Fabric behavior" .grounding\unique-search.json`. Use unique output names: the retrieval CLI refuses to overwrite evidence.
2. Fetch each relevant direct documentation page with `npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/fabric/..." .grounding\unique-page.json`. This calls the actual Microsoft Learn MCP, not a simulated search.
3. Read the result, including applicability, limitations, runtime requirements, identity modes, and Preview notices. Fetch supporting references for detailed implementation claims. Do not treat a search hit or a top-level guide as sufficient technical evidence.
4. Author an original scenario, original distractors, and any original code. Explain why **each** wrong choice fails under the stated constraints. State important assumptions (for example, unique timestamps, passthrough identity, or bounded event lateness).
5. Add a manifest record with the exact documentation title/URL, actual `retrievedAt`, actual `lastReviewedAt`, relevant domain/skill IDs, a short original summary, and status. Context-only sources use `Not applicable`. A page mentioning Preview does not make unrelated established behavior preview, but questions testing a Preview feature must be labelled `Preview`.
6. Align each question's source IDs, titles, and URLs position by position. Give it a stable ID, a fact-level `conceptId`, and exactly one primary objective domain, skill, and subskill from `objectives.json`. Set actual generation and validation timestamps only after doing those actions. Candidates start `manual-review-required`.
7. Have a separate reviewer/context independently inspect the completed question, every correct answer, every distractor, code, prerequisites, and feature status against actual documents. Record question-specific notes/reason and true dates. Only genuinely supported items receive verified metadata; pending, rejected, stale, and legacy unreviewed records remain excluded. See the attestation schema and verification prompt.
8. Run `npm run questions:validate`, `npm run validate:sources`, `npm run validate:sources -- --online`, `npm run questions:duplicates`, `npm run questions:verify`, `npm run questions:coverage`, relevant tests, and `npm run questions:report -- --write`. Inspect findings, gaps, and difficulty balance. Code is documentation-reviewed, not tenant-executed.
9. Commit only short original summaries, citations, reviewed questions, scripts, tests, and both report formats. Full MCP responses and decoded documents remain ignored under `.grounding`. Source changes invalidate affected question snapshots and require re-review.

## What validation means

- `validate`: parses the three JSON files with the shared schema and validates objective alignment, answer structure, distractor explanations, citation alignment, duplicate/near-duplicate questions, and preview labels.
- `validate:sources`: offline structure and direct-URL checks; does not contact Microsoft or establish truth.
- `validate:sources -- --online`: checks unique direct HTTPS English Learn URLs sequentially, with a 12-second total timeout per URL, at most five redirects, and a 2 MB response bound. Every redirect is revalidated before requesting it. Other hosts, credentials, ports, arbitrary query strings, encoded paths, assessment paths, non-HTML responses, HTTP failures, and recognized error pages are rejected. The only query-string exception is Learn's observed canonical redirect for `/en-us/kusto/` pages to exactly `?view=microsoft-fabric`; authored source URLs must still be query-free. Only a completely successful run updates the validation-date line above.
- `content:report` / `questions:report`: computes playable-only counts by every taxonomy level, difficulty, complexity, type, and source; preserves all four candidate statuses, citation/duplicate/quality findings, uncovered subskills, answer positions, and freshness dates. Per-question errors are included in diagnostic reports with a failing exit code. `--write` persists both Markdown and JSON; otherwise it prints without changing files.
- `questions:verify`: requires the independently authored `src\data\verification-reviews.json` ledger, covering every candidate/status, and fails on missing or mismatched records. The build runs this gate after structural validation. Explicit candidate `--questions` paths without `--reviews` run clearly labelled metadata-only mode; use `--reviews` to check a batch ledger. No automatic attestations or status changes are made.
- URL availability is **not** claim validation. Re-fetch and review changed features through MCP. Review whenever Microsoft updates the study guide, a referenced feature changes status, or a source becomes unavailable.

## Scope of this snapshot

The generated coverage reports are authoritative for current playable counts and gaps; pending, rejected, and stale candidates do not contribute to available coverage. Preview behavior requires explicit labels and current supporting evidence. Standard PySpark DataFrame API evidence from Learn's Azure Databricks documentation must be paired with Fabric applicability evidence; it is not evidence for Databricks-only behavior in Fabric.
