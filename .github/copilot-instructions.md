# Content and implementation instructions

- The Certification Dungeon is an unofficial multi-credential study aid, not
  a Microsoft or GitHub practice exam. Preserve the working DP-700 package.
- Before creating or changing questions, use Microsoft Learn MCP
  (`https://learn.microsoft.com/api/mcp`) to retrieve the latest DP-700 study
  guide, certification page, course, and supporting product articles.
- Derive domains, weight ranges, skills, and subskills from the current study
  guide. Preserve its effective date and the actual retrieval date.
- Validate every technical claim, including distractors, code, and feature
  availability. Exclude ambiguous or unsupported claims. Label preview features.
- Write original questions. Never use exam dumps, leaked questions, copied
  assessments, or copyrighted question banks. Paraphrase documentation.
- Cite direct official Microsoft Learn articles, not search pages. Include
  source IDs, titles, URLs, retrieval/review dates, and supporting summaries.
- For other Microsoft credentials, retrieve their own current guides and prep
  materials through Learn MCP. GitHub credentials require official GitHub
  competency and product documentation with credential-scoped source policies.
- A credential record is not playable content. Verify identity/status and the
  current objective map separately; keep unknown, beta, retiring, and
  insufficiently reviewed dungeons sealed. Never infer a future outline is current.
- Keep facts, answers, code, explanations, and citations separate from fantasy
  narration. Classes are generic discovery filters, never internal role bundles.
- Refresh the grounding and objective manifests when documentation changes.
  Never invent MCP responses, citations, or validation dates.
- Run question, source, and coverage validation after content changes.
- Follow `docs/question-bank-maintenance.md` and the generation/verification
  prompts. Generation scaffolding is not an AI model or proof of review.
- Authoring and verification are separate passes/contexts. Re-evaluate every
  option against actual evidence; never batch-stamp candidates verified.
- Assign stable fact-level `conceptId` values. Resolve blocking duplicates,
  inspect quality warnings, and preserve honest review notes and dates.
- Only complete, verified, nonstale records enter gameplay. Keep pending,
  rejected, and stale candidates reportable, but exclude them from available
  coverage. Legacy metadata defaults to manual review, not verification.
- Source reviews newer than question snapshots require independent re-review.
  Freshness is relative to checked-in evidence, never "always up to date."
- Use `questions:verify -- --reviews ...` for machine-readable independent
  attestations; hashes bind exact content, not semantic correctness.
- Commit independently authored attestations for every candidate/status in
  `src/data/verification-reviews.json`. Default verification and the build
  require this ledger; never generate or rubber-stamp attestations to bypass
  failures. Custom `--questions` without `--reviews` is metadata-only authoring.
- Author reviews in their own `src/content/exams/<id>/verification-reviews.json`.
  `reviews:sync` only copies those existing matching records into the consolidated
  ledger; it never creates approvals. Commit both together.
- Every encounter needs an independently scored realism rubric bound to the
  exact objective map/version. Editing an outer version label does not renew a
  review. Preserve old objective snapshots and all local completed history.
- MCP retrieves documentation; it is not a question-generation model. The app
  uses a versioned, build-time-grounded bank, not runtime AI.
- Keep all study data local. No telemetry, browser API keys, unsafe HTML, or
  arbitrary URL proxying. External links must use safe protocols and targets.
- Maintain strict TypeScript, accessible keyboard interactions, responsive
  layouts, and tests for quiz, scoring, persistence, and answer visibility.
