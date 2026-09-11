# Authoritative sources and evidence

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
`Official GitHub documentation`. Independent reviewer attestations describe what
the evidence establishes, including limitations, prerequisites, code and
GA/Preview status. Preview must be labeled.

```powershell
npm run sources:validate -- --exam dp-700
npm run sources:validate -- --exam dp-700 --online
```

Offline validation checks structure, relevance mappings and recorded evidence.
Online checks use bounded requests, a timeout, response-size cap, manually
validated redirects and documentation HTML/PDF checks. Every redirect remains
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
