# GH-600 beta availability snapshot

**GH-600 remains beta, not generally available. Its 136 fully reviewed encounters
are open for beta study in Torchlight Run, Boss Gauntlet, and eligible raids.**
The explicit application-policy change on **2026-09-15** does not change the
official identity evidence below or claim that the vendor exam is available to take.

## Official identity evidence

The following independent retrievals were reviewed on
**2026-09-14T17:57:27.414Z**. These are actual retrieval/review times, not
fabricated exam launch dates.

| Source ID                                      | Official source                                                                                                              | Retrieved                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `gh600-identity-github-agentic-api-20260914`   | [GitHub Agentic AI Developer official certification catalog](https://learn.github.com/api/certifications/AGENTIC)            | 2026-09-14T17:48:35.099Z |
| `gh600-identity-learn-credential-mcp-20260914` | [GitHub Certified: Agentic AI Developer](https://learn.microsoft.com/en-us/credentials/certifications/agentic-ai-developer/) | 2026-09-14T17:48:36.577Z |

The first source was an actual HTTP request to the official GitHub catalog API.
The second was an actual `microsoft_docs_fetch` call through
`https://learn.microsoft.com/api/mcp`. The Learn response confirms the official
name and GitHub's maintenance of the credential; it does **not** establish beta
or general availability.

The API response distinguishes the certification wrapper from its GH-600 exam:

| API field                    | Captured value |
| ---------------------------- | -------------- |
| `certification.code`         | `AGENTIC`      |
| `certification.active`       | `true`         |
| `certification.beta`         | `false`        |
| `exams[0].exam.code`         | `gh-600`       |
| `exams[0].exam.active`       | `true`         |
| `exams[0].exam.beta`         | `true`         |
| `exams[0].exam.betaComplete` | `false`        |
| `exams[0].exam.public`       | `false`        |
| `exams[0].available_to_take` | `false`        |

The more specific exam beta flag controls this dungeon's status. The wrapper's
`beta=false`, an omitted beta label, or an exam scheduling link is not proof of
GH-600 general availability. No booking or assessment was accessed.

The API's certification `updatedDate` is `2026-07-28T12:57:03.7161426Z`; the
exam's is `2026-07-28T12:55:42.2977897Z`. A supplementary HTTP receipt for the
Learn page records `updated_at=2026-07-23T23:52:00Z` and
`Last-Modified: Wed, 05 Aug 2026 08:14:57 GMT`. These source metadata dates are
not an exam effective date or a new objective version.

The API is **identity/status evidence only**, never a technical question source.
Its nested outline is not used to change this package. Historical catalog
evidence remains intact; the new records explicitly supersede earlier
scheduling-based availability interpretations.

Local, ignored raw receipts are preserved under `.grounding\ai-expansion\beta\`:

- `gh600-github-catalog.raw.json` and `gh600-github-catalog.receipt.json`
- `gh600-credential-mcp.json`
- `gh600-credential-http.raw.html` and `gh600-credential-http.receipt.json`
- `identity-status-evidence.json` and `research-integrity.json`

These local receipts are not shipped application data. The checked-in catalog
contains the official URLs, titles, real retrieval times and supporting
summaries.

## Application behavior

The existing `github-agentic-ai-developer` catalog record retains `status: "beta"`
and its verified identity. It now has explicit `allowBetaPlay: true`,
`contentReadiness: "ready"`, and **136 playable encounters**. The shared identity
gate accepts a verified active credential or a verified beta credential with
this explicit catalog authorization. An absent or false flag keeps beta sealed;
unverified, announced, retiring, retired, and replaced identities cannot use it.
This is checked-in application policy, not an imported local setting or vendor
status evidence. Only GH-600 has the authorization.

The card and setup prominently say **BETA · Study access open**,
warn that objectives may change, and identify this as an unofficial study aid.
The notice reflects actual mode readiness and still reports sealed or
Study-only states if other safeguards fail. Question metadata also labels
GH-600 **BETA**, including gauntlet and raid encounters.
The beta designation concerns the exam, not the existing per-question
**Preview feature** designation for product behavior.

Torchlight Run, Boss Gauntlet, legacy exam mode and eligible raids use the same
identity and content gates, including direct calls and imported local settings.
GH-600 is discoverable through the Wanderer filter and normal card entry points.
No other credential is opened. There is no storage migration: existing run
origins, objective snapshots, and completed local history remain intact.

## Preserved content and safeguards

Read-only package validation on **2026-09-14T17:53:38.293Z** found:

- **149** records: **136 fully reviewed**, **13 rejected**, zero validation
  findings. Rejected records remain outside gameplay.
- Reviewed coverage of **6/6 major floors** and **19/19 skills** at the existing
  two-question skill minimum; **56 Advanced/Expert** encounters.
- **130/136 (95.6%)** applied-reasoning encounters. The mature 150-record target
  retains its disclosed **14-record shortfall**.

The normal 25-question study and 75-question gauntlet minima, breadth, weighting,
boss-tier reasoning, strict three-pass review, 44/48 rubric and 40% applied
reasoning safeguards are unchanged. Beta authorization only relaxes the
credential-status gate; it never approves a question, supplies missing evidence,
or overrides freshness, objective binding, review, or mode-readiness failures.

The policy release does not refresh documentation or review dates.
Questions, answers, explanations, citations, objectives, technical sources,
review passes, rubrics and both review ledgers are unchanged. The undated
objective version retains its original content hash and retrieval identity;
its existing objective snapshot retrieval remains
`2026-09-14T13:04:00.402Z`. The catalog's newer identity dates do not renew
technical reviews or rewrite local completed history.
