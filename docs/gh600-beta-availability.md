# GH-600 beta availability snapshot

**GH-600 is identified as beta, not generally available. Gameplay remains
sealed.** This is a partial identity and availability clarification; opening
beta study access was **not implemented**.

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

The existing `github-agentic-ai-developer` catalog record now has `status: "beta"`
and a verified identity. It still has `contentReadiness: "unavailable"` and
**zero playable encounters**. Identity verification does not authorize a run.

The card and sealed setup prominently say **BETA · Gameplay unavailable**,
warn that objectives may change, and identify this as an unofficial study aid.
The beta designation concerns the exam, not the existing per-question
**Preview feature** designation for product behavior.

Torchlight Run, Boss Gauntlet, legacy exam mode and raids still reject beta
credentials, including direct calls and imported local settings. No beta-play
flag, approval, beta run, run-origin migration, or new availability exception
was created. No other credential is opened by this change.

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
reasoning safeguards are unchanged. Passing content safeguards does not
override the beta credential-status gate.

Questions, answers, explanations, citations, objectives, technical sources,
review passes, rubrics and both review ledgers are unchanged. The undated
objective version retains its original content hash and retrieval identity;
its existing objective snapshot retrieval remains
`2026-09-14T13:04:00.402Z`. The catalog's newer identity dates do not renew
technical reviews or rewrite local completed history.
