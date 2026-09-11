---
description: Author original grounded DP-700 candidates from a maintainer request, without self-verifying
---

Read `docs/question-bank-maintenance.md`, `.github/copilot-instructions.md`, the selected workspace's `request.json`, and the workflow schemas under `schemas/`.

This is an unofficial study aid. You are the **author**, not the independent verifier. Microsoft Learn MCP retrieves documentation; it does not generate questions. Never use exam dumps, remembered exam questions, copied assessments, or third-party question banks.

1. Retrieve the latest DP-700 study guide, certification, and course through `https://learn.microsoft.com/api/mcp` using `npm run grounding:retrieve`. Store actual responses in this request's ignored workspace. Check their real timestamps and effective date against the taxonomy; extract and review a candidate taxonomy if changed. Never manufacture MCP responses or dates.
2. Narrow `objectiveTargets` to documented gaps. Map every candidate to a current domain, skill, and exact subskill. Preserve study-guide weights. Retrieve specific implementation articles through MCP; inspect limitations, prerequisites, feature status, terminology, and direct links. A search result or exam overview cannot substantiate an implementation answer.
3. Populate request evidence references with actual files and timestamps. Use stable `conceptId` values identifying the **technical fact or decision**, not the question ID. Reuse an existing concept ID when testing the same fact; do not evade duplicate checks by inventing another ID.
4. Write original candidate stems, code, plausible alternatives, correct answers, explanation, and an explanation of **every** distractor. Advanced/Expert means realistic applied discrimination, not verbosity. Prefer multiple sources for comparisons. State all scenario constraints. Label Preview when tested.
5. Save `generation-output.json` following the generation-output schema. Every candidate starts `manual-review-required`, `requiresManualReview: true`, without `verifiedAt` or invented review dates. Populate `generatedAt` and `lastValidatedAt` only when those actions occur. Do not guess what an independent reviewer will conclude.
6. Export its `candidates` array to `candidates.json` for deterministic CLI validation. Update only the candidate manifest until review/integration. Run questions validation, duplicates/quality, and coverage against these paths. Fix structural defects and blocking duplication; report review warnings honestly.
7. Hand the output, request, source manifest, actual MCP evidence, and diagnostics to a **separate reviewer context/person** using the verification prompt. Do not self-certify. Candidates that lack support remain excluded; do not invent content to fill a quota.

No runtime AI, credentials in the browser, paid service dependency, tenant operations, or automatic verified stamping. Keep original evidence local under `.grounding`; commit only short paraphrases, citations, reviewed records, schemas, and reports.
