# Carving a dungeon

Catalog visibility is not permission to enter. Never infer an active credential,
current name, code, objective, weighting or question bank from the requested list.

1. Run `npm run credentials:discover`. This emits a **request/report**, not
   automatic discovery or verified metadata.
2. For Microsoft, retrieve the current credential, exam, study guide and
   preparation pages through Microsoft Learn MCP. For GitHub, retrieve official
   certification/competency and preparation documentation. Preserve actual dates
   and direct source URLs; do not copy assessments.
3. Update the catalog's exact identity, lifecycle, objectiveVersion and
   verificationEvidence. Missing information stays null/unverified with a
   specific `sealedReason`. Record original dungeon presentation separately in
   `themeMetadata`. Add generic hero-class mappings only for discovery.
   Beta credentials default to sealed; verified beta identity alone is not
   gameplay authorization. GH-600 explicitly enables `allowBetaPlay` in the
   catalog while retaining its beta label and all normal content gates.
   Pending/unverified credentials remain sealed.
4. Review the credential's `sourceAllowlist`. Microsoft uses English Learn
   documentation. GitHub documentation may use bounded docs paths; resource,
   skills and competency PDF URLs require exact, genuinely reviewed URLs.
5. Create `src\content\exams\<credentialId>\` with the files described in
   [architecture](architecture.md). Derive objectives from the current published
   map. Unknown `weightRange` is null/absent, not invented.
6. Generate requests, retrieve documentation, author original candidates, then
   use a **separate** reviewer context. Commit an attestation for every candidate
   status and score the realism rubric independently. There is no bulk
   auto-verification or default passing score.
   Strict GH-300/GH-600 and AI-103/AI-200 require **three** distinct contexts and
   the existing version-2 44/48-minimum rubric. Pin the matching complete
   `three-pass-v1` policy in the catalog and package; follow the
   [GH](gh-three-pass-workflow.md) or [AI](ai-three-pass-workflow.md) workflow.
7. Maintain `encounter-metadata.json` keyed by question ID. Its fingerprint,
   sources, retrieval/validation dates and per-option rationales must match the
   genuine ledger and exact factual record. A pending rubric is null.
   The independent reviewer must also bind the rubric's `objectiveVersion` and
   `objectiveFingerprint` to the actual current outline, with a genuine
   `reviewedAt` not earlier than the taxonomy retrieval. Do not populate these
   fields automatically from old reviews.
8. Run all package checks and inspect warnings. Advertise `limited` only when
   Study readiness passes, and `ready` only when Gauntlet readiness passes.
   Otherwise leave the dungeon validating, stale or unavailable.

```powershell
npm run credentials:validate
npm run objectives:refresh -- --exam dp-700
npm run questions:generate -- --exam dp-700 --count 25 --difficulty advanced:60,expert:40 --id original-batch --author maintainer-name
npm run questions:validate -- --exam dp-700
npm run questions:verify -- --exam dp-700
npm run questions:duplicates -- --exam dp-700
npm run questions:coverage -- --exam dp-700
npm run sources:validate -- --exam dp-700
npm run questions:report -- --exam dp-700 --write
npm run content:validate-all
```

Replace `dp-700` with the catalog ID. An uncarved credential requires an actually
retrieved candidate taxonomy supplied with `--taxonomy`; scaffolding cannot
invent one. `--floors` (alias `--domains`) takes current domain IDs separated by
commas. `--difficulty` accepts `mix` (alias `mixed`), a difficulty list, or
percentages summing to 100.

The map can expose 25 genuinely reviewed encounters as Study-only. Never
duplicate, inflate or manufacture a 75-item bank to unlock the Gauntlet. Product
quantity targets are not permission to lower the quality bar.
