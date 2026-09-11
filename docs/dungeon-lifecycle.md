# Objective and credential lifecycle

Freshness is relative to checked-in evidence, never “always current.”
`credentials.json` records actual authoritative identity review dates; question,
source and rubric review dates describe separate acts. Report creation is not
grounding or verification.

Only verified **active** credentials can enter a run. Announced, beta, retiring,
retired, replaced and unverified entries remain visible but sealed. An active
credential without a sufficiently reviewed bank is also sealed or Study-only.
Do not silently rename a historical exam record as its replacement.

Provider status and current-map completeness are separate facts. If registration
is authoritatively active but only a future objective map is available, retain
`status: "active"` with retrieved identity evidence, `isVerified: false`,
`objectiveVersion: null`, zero playable encounters and an explicit sealed reason.
Never invent a current map or mislabel known provider status just to satisfy a
validation gate. This state cannot enter any run.

## Refresh workflow

```powershell
npm run objectives:refresh -- --exam dp-700 --output .grounding\dp700-refresh-request.json
# Retrieve current official pages through the appropriate authoritative workflow.
# Extract and inspect a candidate taxonomy, then:
npm run objectives:refresh -- --exam dp-700 --candidate .grounding\objectives.candidate.json
```

These commands prepare requests/diffs and do not overwrite content, fabricate
MCP evidence or mark candidates reviewed. Inspect changes to domain titles,
weights, skills and subskills as well as the published version.

When adopting a changed map:

1. Record the prior version, actual replacement timestamp and review notes in
   package `objectiveHistory`; retain historical source/encounter evidence.
2. Update the catalog and package to the current objective version, preserving
   the guide's actual effective date and retrieval timestamp.
3. Keep existing encounter envelopes on their reviewed version. Mismatching
   versions become effective `stale` automatically. No historical data is
   destroyed or “fixed” by overwriting facts.
4. Independently re-review affected records against actual evidence. Each rubric
   requires reviewer-authored `objectiveVersion` and `objectiveFingerprint`.
   `objectiveFingerprint(taxonomy)` is exported from the shared and script review
   helpers; it hashes version, exact guide URL, and all domain/skill/subskill/
   weight content, excluding retrieval time. Same-version wording or weight
   changes invalidate the old binding too, even if every existing question still
   maps to a valid subskill.
5. The reviewer must re-read the actual outline and record a genuine
   `reviewedAt >= taxonomy.retrievedAt`. Identical re-retrieval preserves the
   content hash but does not waive this chronology check.
6. Only after genuine independent review update the relevant envelope/ledger
   snapshots and rubric, then rerun validation and readiness checks. Rewriting
   outer version strings or timestamps alone never renews an objective review.

A source review newer than a question's snapshot also makes that question stale.
Changing substantive text, citations, answers or generation/validation dates
invalidates the existing attestation fingerprint. Reusing an old rubric or
updating a timestamp alone is not a review. Legacy rubrics without objective
bindings remain excluded; validators never infer or populate those bindings.

Runs retain their source credential and objective version. Historical answers,
scores and local progress are not retroactively rewritten as current mastery.
Use freshness and sample-size warnings when presenting earlier performance.
