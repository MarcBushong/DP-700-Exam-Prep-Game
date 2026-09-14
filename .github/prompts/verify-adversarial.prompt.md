# Pass 3: independent credential-specific adversarial challenge

Use a third context distinct from both the request's author and technical
reviewer. Re-read the current guide, admitted sources, provenance and unchanged
candidate. Try to disprove its answer rather than merely confirm pass 2.

For every option, including correct options, find the conditions under which it
could be correct. Search the admitted evidence for qualifications, contradictory
behavior, omitted prerequisites and changed availability. Test the relevant
database platform, API, version, edition, service scope, identities, permissions,
deployment environment and Preview status. Explain nonapplicable dimensions;
do not import another credential's plan or organization-scope assumptions.

Persist `claimRepresented`, `whyIncorrectInContext`, `couldBeCorrectWhen`,
`sourceIds` and `evidenceSummary` for each option. For a correct option, explicitly
explain why it is supported, not incorrect, in this context. Record each required
challenge: scope, plan, role, preconditions, featureStatus, sourceChanges,
stemSufficiency, explanationBounds, reasoningDepth and answerClues.

Independently score all twelve version-2 criteria from 0 to 4: alignment,
accuracy, scenarioCompleteness, answerUniqueness, distractorPlausibility,
distractorEvidence, documentationStrength, citationSpecificity,
difficultyAuthenticity, explanationQuality, originality and clarityAccessibility.
Accuracy, answerUniqueness, documentationStrength and citationSpecificity require
4; distractorEvidence requires at least 3; no criterion may be zero; total must
meet the unchanged package threshold, at least 44/48. Do not convert old scores
or derive judgments from JSON field presence.

Bind adversarial results and the rubric to the exact question and current
objective fingerprints, actual distinct reviewer, and a time after pass 2.
Write a full independent final attestation for every retained candidate/status
to its package `verification-reviews.json`. The final ledger and rubric use the
same adversarial identity and time. `reviews:sync` only copies those existing
matching attestations into the consolidated ledger; it cannot create approvals.

Promote only candidates that pass every source, technical, adversarial, rubric,
duplicate and freshness requirement. Rejected, manual-review, stale and pending
records never play. Any authored repair restarts all three passes. A reviewed
bank still cannot bypass unverified identity, a prospective objective map, or
the independent Study/Boss readiness gates.
