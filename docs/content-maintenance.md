# Maintaining grounded practice content

This bank is independent, original practice material, not an official Microsoft exam or a collection of exam questions. Never use dumps, remembered exam content, copied assessments, or large documentation excerpts.

Last successful online URL validation: 2026-09-11T16:24:16.327Z (29 unique URLs).

## Source of truth and evidence

The Microsoft Learn DP-700 study guide retrieved through the Learn MCP endpoint is authoritative for the objective taxonomy. The current snapshot is effective **July 21, 2026**, retrieved **2026-09-11T16:05:00.959Z**. It contains three domains, ten skills, and 54 subskills. Do not hand-edit objectives to make coverage look complete.

The certification and instructor-led course pages were retrieved for context, but dynamic skill sections returned “Loading” placeholders. The self-paced **Manage a Microsoft Fabric environment** path and relevant CI/CD and monitoring modules were separately retrieved. Only instructional learning units were followed; assessment and knowledge-check pages were not opened.

## Review workflow

1. Run `npm run grounding:retrieve -- search "specific Fabric behavior" .grounding\unique-search.json`. Use unique output names: the retrieval CLI refuses to overwrite evidence.
2. Fetch each relevant direct documentation page with `npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/fabric/..." .grounding\unique-page.json`. This calls the actual Microsoft Learn MCP, not a simulated search.
3. Read the result, including applicability, limitations, runtime requirements, identity modes, and Preview notices. Fetch supporting references for detailed implementation claims. Do not treat a search hit or a top-level guide as sufficient technical evidence.
4. Author an original scenario, original distractors, and any original code. Explain why **each** wrong choice fails under the stated constraints. State important assumptions (for example, unique timestamps, passthrough identity, or bounded event lateness).
5. Add a manifest record with the exact documentation title/URL, actual `retrievedAt`, actual `lastReviewedAt`, relevant domain/skill IDs, a short original summary, and status. Context-only sources use `Not applicable`. A page mentioning Preview does not make unrelated established behavior preview, but questions testing a Preview feature must be labelled `Preview`.
6. Align each question's source IDs, titles, and URLs position by position. Give it a stable ID and exactly one primary objective domain, skill, and subskill from `objectives.json`. Set actual generation and validation timestamps only after doing those actions; never future-date a review.
7. Run `npm run validate`, `npm run validate:sources`, `npm run validate:sources -- --online`, `npx vitest run tests/grounding.test.ts`, and `npm run content:report -- --write`. Inspect the report's gaps and difficulty balance. Code exercises are not verified by executing them in a tenant; that would require a separately authorized environment.
8. Review the changed questions against the fetched pages. Commit only short original summaries, citations, questions, scripts, tests, and coverage documentation. Full MCP responses and decoded documents remain ignored under `.grounding`.

## What validation means

- `validate`: parses the three JSON files with the shared schema and validates objective alignment, answer structure, distractor explanations, citation alignment, duplicate/near-duplicate questions, and preview labels.
- `validate:sources`: offline structure and direct-URL checks; does not contact Microsoft or establish truth.
- `validate:sources -- --online`: checks unique direct HTTPS English Learn URLs sequentially, with a 12-second total timeout per URL, at most five redirects, and a 2 MB response bound. Every redirect is revalidated before requesting it. Other hosts, credentials, ports, arbitrary query strings, encoded paths, assessment paths, non-HTML responses, HTTP failures, and recognized error pages are rejected. The only query-string exception is Learn's observed canonical redirect for `/en-us/kusto/` pages to exactly `?view=microsoft-fabric`; authored source URLs must still be query-free. Only a completely successful run updates the validation-date line above.
- `content:report`: computes counts by every taxonomy level, difficulty, complexity, and format; lists uncovered subskills and freshness dates. It fails closed when content is structurally invalid. `--write` persists the report; otherwise it prints without changing files.
- URL availability is **not** claim validation. Re-fetch and review changed features through MCP. Review whenever Microsoft updates the study guide, a referenced feature changes status, or a source becomes unavailable.

## Scope of this snapshot

All ten skills are sampled, but not every subskill is covered. The generated coverage document lists the gaps honestly. GA-focused examples intentionally avoid unverified preview behavior. Standard PySpark DataFrame API evidence from Learn's Azure Databricks documentation is paired with Fabric's Python support page; it is not evidence for Databricks-only behavior in Fabric.
