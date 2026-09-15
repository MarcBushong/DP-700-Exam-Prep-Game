# AI review queue: defect classification and repair paths

This continuation starts from local commit `1dd10c8`. The diagnosis alone did not
create approvals; the completed fresh review outcomes are recorded below.
It does not declare the 150-each goal achieved or reopen a dungeon.
The starting inventory was AI-103: 29 verified / 96 manual / 24 rejected;
AI-200: 27 verified / 89 manual / 34 rejected. Both have zero playable records.

## What the manual queues actually contain

These are counts of explicit false checks in the starting independent final
review records, not keyword counts or automatic validator decisions. Categories
overlap and must not be added together.

| Failed review check       | AI-103 manual records | AI-200 manual records |
| ------------------------- | --------------------: | --------------------: |
| Quality reviewed          |                    79 |                    63 |
| Feature status            |                    24 |                    26 |
| Direct sources            |                     6 |                    29 |
| Explanations supported    |                     8 |                    25 |
| Correct options supported |                     7 |                    19 |
| Answer defensible         |                     3 |                     6 |
| Prerequisites complete    |                     1 |                     5 |
| Distractors incorrect     |                     2 |                     4 |
| Duplicates reviewed       |                     3 |                     1 |

Separately, **18 AI-103 and 47 AI-200 manual records cite withdrawn sources**.
That dependency count differs from `directSources: false`: earlier nonverified
reviews were preserved rather than batch-rewritten after a source withdrawal.
Current provenance validation still excludes every dependent record.

## Genuine evidence and content defects

- **Unapproved extra citations still matter.** For example, `ai200-c-002`
  retains a supported digest-selection key in an approved storage unit, but also
  cites an article whose parent reference was not established. Other correct
  evidence does not make the extra citation approved.
- **Some replacements need additional admitted evidence.** `ai200-c-003` uses
  maintained-base servicing and dependent-task behavior. Its retained storage
  citation alone does not cover the entire explanation. `ai200-c-004` cites only
  the withdrawn tagging article. Neither can be repaired by deleting a source ID
  and inheriting the old approval.
- **Distractor countercontexts can be unsupported.** `ai103-010` has a sound key
  but its literal alternative return fields lack a documented valid context in
  the admitted sources. Inventing a schema variant or identifier collision would
  not satisfy the option-evidence requirement.
- **Explanations can exceed their citations.** `ai103-011` contains an extra
  endpoint assertion without sufficient current admitted support.
- **Classification can overstate the task.** `ai103-004` was withheld because a
  routine two-axis deployment lookup does not substantiate its Advanced label.
  A code block or scenario introduction alone does not establish applied reasoning.
- **Release-status evidence needs claim-level review.** The 24/26 feature-status
  failures are not findings that all those features are Preview. They are evidence
  gaps or unresolved classifications. Current documented baseline behavior,
  explicitly preview-qualified extensions, and exam beta status must be
  distinguished; neither a magic-word test nor a blanket GA assumption is a
  substitute for the actual source.

The withdrawn references were inspected against actual parent bodies. Naming
a product, library or feature and successfully fetching a chosen article did not
establish that the parent identified that documentation. This is an evidence
defect, not merely an overly restrictive hostname regex.

## Confirmed implementation or process errors already corrected

| Error                                                                                   | Correction and boundary                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Azure AI Search article paths treated as search results                                 | Bounded product-article exception; search endpoints remain rejected.                                                                 |
| Textual Content Understanding video documentation treated as video media                | Exact documentation-family exception; media/show sources remain disallowed.                                                          |
| Course-UID ancestry collapsed into a credential-to-path shortcut                        | Complete credential/course/path/module/unit graph; course remains ancestry-only.                                                     |
| Client-side fragments treated as different HTTP documents                               | Fragment-only comparison correction; other URL differences remain checked.                                                           |
| Recorded/intermediate Foundry redirect targets absent from the transport list           | Exact observed URLs added; no technical source approval granted.                                                                     |
| Already-grounded layout v4.0 moniker rejected during redirect validation                | Exact AI-103 article/version exception; other versions/parameters rejected and stored citations stay query-free.                     |
| Repair reviewer treated reset verification notes/confidence as authored factual changes | Reconsidered using the shared fingerprint's explicit verification-metadata exclusions; no source, option or rubric criterion waived. |
| Source-curation summary incorrectly excluded Cosmos `float16`                           | Separate corrected source snapshot with real review time and preserved prior record; no current candidate cited the affected unit.   |

The current machine validators do not score question realism or decide that a
scenario is genuinely applied. Those are independent recorded judgments. Passing
schemas cannot overturn them; an incorrectly applied judgment must be revisited
by the appropriate independent context.

Partial-review commands also need the correct input scope. Supplying a small
question subset alongside the entire manifest can produce errors for withdrawn
sources that none of those questions cites. A partial check should include its
actual cited-source set and complete required ancestry, while the final installed
package must still validate every current record and source dependency. This is
not permission to ignore a withdrawn source used by a question under review.

## Bounded continuation

The first continuation batch targeted `ai200-c-002`, `ai200-c-003`,
`ai200-c-004`, and `ai200-c-006`. The existing author context reread
approved ACR storage, versioning and task units to determine whether they could
support every claim and option without the withdrawn articles.

Only evidence-supported repairs proceed. Changing citations or classifications
creates a new authored hash and requires fresh technical and adversarial passes;
old histories remain preserved. No current count changes until those passes
finish. The existing source policy, 44/48 rubric and availability gates are not
being relaxed. The continuation initially excluded committing, pushing and PR
creation; the user subsequently authorized those delivery steps.

Fresh authoring produced four candidates with thirteen option mappings against
three approved training sources, generated at `2026-09-14T22:11:04.246Z`.
The composite-tag reasoning in c-004 is explicitly identified as a derivation,
not a quoted platform guarantee; c-006 is classified as foundational recall.
These remained unpromoted while a separate existing technical-review context
checked the new exact hashes and evidence.

The fresh technical review completed at `2026-09-14T22:23:49.636Z`: all four
records and thirteen options passed that stage against the three approved raw
training units. It accepted c-004's constrained derivation and c-006's
foundational classification. This is **pass 2 only**, not gameplay approval.
The existing independent semantic and adversarial contexts then reviewed
the new hashes; that technical stage alone changed no production counts.

The semantic recheck completed at `2026-09-14T22:33:53.351Z`, covering four
replacements and the unchanged 295 current candidates. It renewed the
c-003/c-012 distinction but found c-002 duplicates `gh600-b-034`, with an
additional c-002/s-004 overlap concern. The adversarial reviewer must account
for those findings before any final approval; a repaired citation alone does
not resolve an originality defect.

## Continuation outcome

Fresh adversarial review completed at `2026-09-14T22:42:08.027Z`: c-003,
c-004 and c-006 passed; c-002 was rejected as a duplicate of gh600-b-034.
All thirteen options, the new source mappings, rubric scores and exact hashes
were independently reviewed. The prior four records and their complete reviews
are preserved under `ai-200/audit/continuation-acr-repair/`.

The current AI-200 bank is **30 verified / 85 manual / 35 rejected**,
still 150 records and zero playable. Its approved-source counts are unchanged;
no withdrawn article was restored or silently treated as approved. There are
53 current AI-200 records depending on withdrawn sources, down from 57 because
these four revisions now cite approved training evidence. AI-103 remains
29 verified / 96 manual / 24 rejected, with zero playable.

Continuation checks passed: **664 unit tests in 35 files**, **12 targeted
desktop/mobile AI and beta browser tests**, lint, typecheck and the production
build. All six AI-200 question/source diagnostic commands, cross-exam semantic
duplicate diagnostics, and the complete installed-content gate passed.
The earlier 72-test full-browser result remains evidence for the committed
delivery; the continuation's browser result is explicitly the targeted 12-test
run, not a claim that the full suite was rerun.

Current reviewed AI-200 content has 9 Beginner, 17 Intermediate, 4 Advanced and
0 Expert records; 20/30 (66.7%) have genuinely applied classifications. Its
fourth domain remains unsampled by verified content. There are 176 diagnostics
(43 citation/provenance, 133 editorial quality), with zero blocking errors.
The user subsequently requested a pull request for this reviewed state.
