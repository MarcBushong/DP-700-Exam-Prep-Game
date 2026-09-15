# Pass 2: independent credential-specific technical review

Use a context and reviewer identity different from the request's author. Read
the actual current objective map, source policy and retrieved official sources;
do not trust the generator's key, confidence, summaries or proposed difficulty.
The existing three-pass schemas and `docs/gh-three-pass-workflow.md` apply without
borrowing another credential's objectives or source permissions.

For each candidate, independently re-derive every option's claim in the stated
context. Establish exactly one defensible single-select answer or the complete
multi-select set. Check the key, all distractors, code, explanation, prerequisites,
scope, platform/version, permissions, terminology and GA/Preview qualification
against exact admitted evidence. Confirm that citations resolve and the entire
provenance chain reaches this credential's guide or linked training. A matching
hostname or page topic is insufficient.

Examine duplicate and construction warnings, including fact-level cosmetic
variants, reused setups, answer-position skew, grammar and answer-length clues.
Reject unsupported, ambiguous or inflated questions; record the specific failure.
Do not repair an authored field and silently bind the old pass to new content.
Any rewrite requires fresh generation and both subsequent independent passes.

Persist a complete `QuestionReview` under the candidate's `technical.review` in
`validation-metadata.json`, including source snapshots, each option's assessment,
actual author/reviewer identities and time, exact question fingerprint, all
review checks, and question-specific notes. Independently bind the current
`objectiveVersion` and `objectiveFingerprint`.

A technical `verified` verdict means only that this pass approved the candidate.
The candidate remains excluded until a third context completes adversarial
review, independently scores the strict rubric, and supplies the final ledger.
Keep failures reportable; never manufacture a final attestation or rubric.
