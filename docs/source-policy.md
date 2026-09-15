# Authoritative sources and evidence

## Strict guide-linked packages

Packages declaring `reviewPolicy.version: "three-pass-v1"` additionally require
`source-registry.json`. This is an opt-in stricter policy; credential identity
metadata and legacy DP-700/Microsoft/GitHub packages do not acquire new technical
source permissions. See the [GH workflow](gh-three-pass-workflow.md) or
[AI-103/AI-200 workflow](ai-three-pass-workflow.md). The same engine/profile
applies; there is no separate AI source validator.
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
study guide; **B** official Learn self-paced paths/modules linked or explicitly
referenced by the guide or credential, including the current-course bridge below;
**C** official documentation directly linked or clearly referenced by
A/B and approved by the selected credential's technical allowlist.
For strict GitHub packages C may use HTTPS `learn.microsoft.com` or
`docs.github.com` under that credential's explicit rules. For AI-103/AI-200,
all technical evidence is direct English HTTPS `learn.microsoft.com` material;
GitHub Docs is not permitted. A shared strict profile or another credential's
allowlist cannot widen these approvals.
Registry training module child units may follow a finite training-parent chain.
A documentation parent must immediately be a guide or self-paced training source,
never a course overview or an unbounded doc-to-doc chain. Cycles fail. Every
ancestor must satisfy its credential/objective bindings, approved source class,
dates and genuine link/reference evidence.
Blogs, videos, forums, quizzes, knowledge checks, practice assessments, dumps,
internal materials, Trust Center and other resources are not allowed, even when
another legacy credential's host allowlist accepts them.

The current course is an **ancestry-only bridge**, not technical evidence.
A Learn `/en-us/training/courses/` record may use `sourceClass: "training"` only
when its canonical URL exactly matches `credential.officialUrls.training` and
its parent is the current guide or exact `credential.officialUrls.credential`.
Where the credential references a course UID and the course HTML references path
UIDs, preserve those observed `explicit-reference` receipts and the complete
credential -> course -> path -> module -> unit graph. Do not replace this with
an invented credential -> path direct link. A course never contributes technical
`validatedSupportingSourceIds` and cannot directly parent a `doc`; documentation
still requires an actual guide/self-paced-training link or reference.

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

AI-103 and AI-200 approvals are independent even when they cite the same URL.
Retrieve each credential's own current guide and linked preparation material;
preserve its root-to-source provenance, actual retrieval/review dates and
objective relevance. Approve only the bounded paths or exact URLs actually
needed for that credential. The guide/credential can establish identity or
scope, but cannot replace implementation evidence for an answer or distractor.
A source retrieval failure withholds dependent candidates; it never licenses
an unapproved fallback. This does not change legacy DP-700 source or review rules.

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

The narrow textual Content Understanding article exception permits only HTTPS
`learn.microsoft.com` URLs with paths matching
`/en-us/azure/ai-services/content-understanding/video/[a-z0-9-]+`.
Credential allowlisting and full provenance remain mandatory; videos, shows,
media and search pages stay barred. This does not expand DP-700 permissions.

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
inside that credential's allowlist. The existing canonical Learn Kusto and
T-SQL view redirects remain supported. Strict Microsoft DP-800 additionally
recognizes the actually observed `view=sql-server-ver17` redirect for its
explicitly approved `/en-us/sql/relational-databases/` articles. Same-document
receipt comparison removes only that validated moniker; different articles,
unknown views and additional parameters remain rejected. Stored citations stay
query-free, and the legacy DP-700 relational-document policy is unchanged.
The additional AI-103 layout exception is specified below.
Expected-versus-resolved document comparisons ignore client-side URL fragments
and the specifically recorded AI-103 layout selector. Other scheme, host, port,
path and query differences still fail. Recorded fragment receipts remain
unchanged. This does not relax credential allowlists,
redirect validation, the 2 MB cap, MIME checks or timeouts.
URL availability is not a semantic review and does not update source review
dates or promote encounters.

Identity/competency-only `learn.github.com` entries in a source manifest are
checked against the narrow provider-aware identity URL policy offline. The online implementation
document checker explicitly skips and counts those entries; their availability
belongs to the separate credential-discovery workflow and captured API receipts.

AI-103 also accepts the observed redirect to the exact layout article's
`view=doc-intel-4.0.0` moniker during online checks only. That v4.0 GA section
was already present in the frozen MCP evidence; other Document Intelligence
versions, paths and extra query parameters remain rejected. Stored citations
remain query-free. Exact recorded or observed intermediate Foundry redirect
URLs are transport-only allowlist entries, not new technical source approvals.
The checker separately reports retained citation snapshots whose supporting
registration has been withdrawn.

The browser makes no documentation-proxy or generation requests and has no API
keys. It opens safe official links to the unchanged cited document. Keep raw
retrieved responses in local ignored grounding workspaces; commit original
summaries and evidence metadata rather than copied document bodies.
