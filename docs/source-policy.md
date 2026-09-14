# Authoritative sources and evidence

## GH strict guide-linked packages

Packages declaring `reviewPolicy.version: "three-pass-v1"` additionally require
`source-registry.json`. This is an opt-in stricter policy; credential identity
metadata and legacy DP-700/Microsoft/GitHub packages do not acquire new technical
source permissions. See [the complete workflow](gh-three-pass-workflow.md).
Catalog `requiredReviewPolicy` can independently require that same profile.
The matching package declaration is mandatory, not a switch an edited package
can remove to bypass provenance or either independent review stage.

In strict packages, evidence role is **not** inferred from feature availability.
An approved direct training unit or documentation article may legitimately have
`featureStatus: "Not applicable"` when its claims concern principles rather
than a GA/Preview feature. Keep the curator's recorded status unchanged.
`validatedSupportingSourceIds` derives supporting roles only from exactly bound,
schema-valid `training`/`doc` records whose entire ancestry is valid, plus the
credential allowlist. Guide-only, credential/course overview, invalid-registry and
unapproved-source citations cannot supply this role. The strict flag alone
does not grant it. All claim mappings and both independent review stages remain
required for gameplay. Legacy packages retain their prior source-role rules.

Source failures are attributed to every question citing that source **or any
descendant**, before nonverified quarantine findings can become warnings.
Reachability requires valid ancestor schemas, classes, exam/objective bindings,
dates and link receipts—not merely a path to a node named as a guide. Missing
ancestors and cycles fail closed. An invalid branch cited only by a quarantined
candidate grants no evidence role, but does not invalidate an unrelated approved
branch. Malformed registry headers or unidentifiable records remain global
failures; no verified descendant can inherit a quarantined ancestor's approval.

Allowed technical provenance is exclusively: **A** the current official Learn
study guide; **B** official Learn self-paced paths/modules linked by the guide or
credential; **C** official Learn or `docs.github.com` documentation directly
linked or clearly referenced by A/B. Registry training module child units may
follow a finite training-parent chain. A documentation parent must immediately
be guide/training, never an unbounded doc-to-doc chain. Cycles fail.
Only HTTPS `learn.microsoft.com` and `docs.github.com` technical evidence is
allowed. Blogs, videos, forums, quizzes, knowledge checks, practice assessments,
dumps, internal materials, Trust Center and other resources are not allowed,
even when another legacy credential's host allowlist accepts them.

Each source stores sourceId, canonicalUrl, title, retrievedAt, lastValidatedAt,
examCode, objectiveIds, sourceClass (`guide|training|doc`), contentRelevance and
parents. Source IDs/URLs/titles/retrieval dates/review dates/objectives bind the
source manifest (registry lastValidatedAt equals source lastReviewedAt).
Ancestor-only registry records are allowed, but every manifest source needs an
approved registry entry. All domain/skill IDs must exist in the current map.

Each parent stores sourceId (or, for training only, the exact official Learn
credentialUrl), relation (`direct-link|explicit-reference`), targetUrl,
canonicalUrl, actual retrievedAt, evidenceSummary and relevanceJustification.
Capture the observed target and canonical redirect receipt for a direct link;
for an explicit reference, preserve a short actual reference passage and justify
the exact source/claim relevance. A hostname or topical relationship alone is
never provenance. Link receipts must precede source validation.

A credential page may render a locale-neutral Learn link such as
`https://learn.microsoft.com/training/paths/<path>/`. Preserve that observed
target instead of relabeling it as an English link. A narrowly allowed
`direct-link` training receipt must map exactly to the same path under
`/en-us/training/paths/` or `/en-us/training/modules/`. Canonical evidence URLs
remain English and credential-allowlisted. This exception does not admit
locale-neutral technical documents, other locales, explicit-reference targets,
query strings, unsafe paths, or redirects to a different source. Actual
retrieval/redirect evidence is still required; string normalization is not proof.
The online checker admits these targets only through the validated registry's
direct training receipts and checks the canonical English URL against the
unchanged credential allowlist. A missing redirect or a redirect to a different
URL fails, even when that different URL would otherwise be approved. Unbound
targets remain rejected before network access.

These helpers validate **recorded declarations**, not the truth of a link,
reference passage, citation's meaning or reviewer independence. Curators must
actually inspect and preserve retrieval evidence; independent technical and
adversarial reviewers must check exact claims. Bounded online availability
checks remain separate from claim review and never promote questions.

Microsoft credentials use Microsoft Learn MCP retrieval and direct English
Learn articles. DP-700 retains its strict HTTPS `learn.microsoft.com` contract:
approved product/training/credential paths, no search pages, assessments, unsafe
encoding, credentials, ports or stored query strings.

GitHub credentials use official GitHub competency and product documentation.
`officialSourceUrlSchema` recognizes potential official source shapes; it is
**not global permission for encounters**. Technical source URLs are then checked
against the selected credential's explicit `sourceAllowlist`. Credential identity
and competency evidence is separate: direct official URLs must match the provider
and the catalog's recorded primary URLs must have actual retrieval evidence.

- The actually captured GitHub identity pages/API on `learn.github.com` are
  restricted to `/certification/{COPILOT,GHAS,AGENTIC}` and corresponding
  `/api/certifications/` keys. The exact retrieved URLs belong in that
  credential's `verificationEvidence`, not its technical `sourceAllowlist`. These are
  identity/competency-outline evidence, never implementation citations for
  encounters. An API outline may ground the taxonomy or a `Not applicable`
  context source; it cannot replace supporting product documentation.
  Technical source-rule schemas reject `learn.github.com` entries entirely.
- `docs.github.com`: bounded, reviewed documentation-directory prefixes or
  exact URLs; a root-host wildcard is not permitted.
- `skills.github.com`, `resources.github.com`, and `github.com/resources/`:
  exact reviewed URLs only, including official competency PDFs where verified.
- Microsoft Learn for a GitHub question requires an explicit credential rule
  and direct relevance; it is not silently enabled for all GitHub questions.
- Microsoft credentials cannot cite GitHub by borrowing another credential's
  policy. Community articles, repositories, copied assessments and arbitrary
  URLs are never authoritative fallbacks.

Catalog identity URLs and verificationEvidence use the separate provider-aware
identity policy; accepting identity evidence never approves a technical source.
`credentialEvidenceUrlSchema` names that verification-evidence contract explicitly;
`isAllowedIdentityUrl` applies its provider guard, while `isAllowedSourceUrl`
independently applies the technical allowlist and rejects identity APIs.
Source records additionally map to current objective domains and skills.
Each option's claim envelope references the exact genuinely attested rationale
and source IDs. A page about the general topic is not enough: evidence must
support the correct option **and the distinction from each alternative**.

The generic Microsoft policy also recognizes retrieved Entra, Defender XDR,
Defender for Endpoint, Defender for Cloud Apps, Security and Microsoft 365
documentation families. A credential must still explicitly approve the relevant
bounded paths or exact URLs. DP-700 and `learnUrlSchema` retain their original
strict product-prefix contract; expanding another credential does not expand
DP-700 or permit arbitrary English/private Learn paths.

Azure AI Search implementation articles under `/en-us/azure/search/<article>`
are product documentation, not Learn search results. The generic policy permits
that bounded article shape when the credential explicitly approves it, while
search endpoints, query strings, directory roots and assessments remain rejected.
The legacy DP-700 `learnUrlSchema` retains its original restriction.

## Retrieval versus availability versus review

Actual retrieval timestamps and source titles/URLs are preserved in the
manifest. `retrievalMethod` distinguishes `Microsoft Learn MCP` from
`Official GitHub documentation`; strict mixed banks can explicitly record
`Microsoft Learn MCP and official GitHub documentation`. Independent reviewer attestations describe what
the evidence establishes, including limitations, prerequisites, code and
GA/Preview status. Preview must be labeled.

```powershell
npm run sources:validate -- --exam dp-700
npm run sources:validate -- --exam dp-700 --online
```

Offline validation checks structure, relevance mappings and recorded evidence.
Online checks use bounded requests, a timeout, response-size cap, manually
validated redirects and documentation HTML/PDF checks. GitHub Docs requests may
use its official `text/markdown` representation at the same approved URL; a
document heading is required, error pages are rejected, and the existing 2 MB
cap still applies. This avoids treating a large HTML navigation shell as missing
evidence without increasing or disabling the bound. Every redirect remains
inside that credential's allowlist. Only the existing canonical Learn Kusto and
T-SQL view redirects are accepted; stored citations remain unchanged/query-free.
URL availability is not a semantic review and does not update source review
dates or promote encounters.

Identity/competency-only `learn.github.com` entries in a source manifest are
checked against the narrow provider-aware identity URL policy offline. The online implementation
document checker explicitly skips and counts those entries; their availability
belongs to the separate credential-discovery workflow and captured API receipts.

The browser makes no documentation-proxy or generation requests and has no API
keys. It opens safe official links to the unchanged cited document. Keep raw
retrieved responses in local ignored grounding workspaces; commit original
summaries and evidence metadata rather than copied document bodies.
