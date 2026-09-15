# The Certification Dungeon

**Bring a torch. Bring evidence. Leave the exam dumps outside.**

A browser-based technical study platform disguised as a dungeon crawl. Choose
a hero class, explore the credential map, and enter only dungeons with enough
independently verified encounters. A rogue Dungeon Master supplies the flavor;
official documentation supplies the facts.

**Unofficial study aid. Not affiliated with or endorsed by Microsoft or GitHub
Certification. Not an official exam, practice assessment, or source of real exam questions.**

## Launch in your browser

**[Enter The Certification Dungeon](https://marcbushong.github.io/The-Certification-Dungeon/)**

The app is live on GitHub Pages. This repository is public, so a GitHub Pro
upgrade is not required to host it. The app and its bundled question bank are public.

Open the link in a modern desktop or mobile browser with JavaScript
enabled. The entire app runs in your browser: challenge setup, quizzes, scoring,
review, settings, and result downloads. No installation, Node.js, account, API key,
or Azure subscription is needed to play. Study progress stays in your browser's
local storage, not on GitHub. Loading the app requires internet access.

## Run locally or develop

Install **Node.js 22 LTS (22.12 or newer)** and npm, then run from this repository:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally [http://127.0.0.1:5173](http://127.0.0.1:5173)).
No account, API key, database, Azure subscription, Docker, or environment
variables are required. Initial dependency installation needs internet access.
The quiz itself uses bundled content and does not call an AI service.

Every dungeon has its own source manifest, objective version, evidence ledger,
and readiness state under [`src/content/exams/`](src/content/exams/). Exact
retrieval and review timestamps appear in the packages and catalog. These banks
are versioned, **not always current**. Product behavior and objectives change.

## Choose your expedition

The **Dungeon Map** supports generic hero-class filters, code/name/product
search, favorites, and visible readiness. **The Tavern** shows local progress
and sample-aware recommendations. **The Forge** prepares maintainer generation
requests; it does not call a model or generate answers in the browser.

**Torchlight Runs** are study sessions with explanations and tome links.
**Boss Gauntlets** withhold feedback until the end and require a larger,
broader verified bank. Their timer is a configurable practice timer, not an
invented official exam duration. **Raids** mix eligible dungeons without letting
one large bank dominate, and preserve each encounter's source and floor scores.

A catalog entry is not an open dungeon. By default, Study Runs require at least
25 verified encounters and every major floor; Gauntlets require at least 75,
skill breadth, boss-tier content, and no blocking failures. Sealed, stale,
retiring, beta, and insufficiently reviewed content stays out of play.

The map represents all 18 requested identifiers. AZ-800 is explicitly retiring;
GH-600 is beta; DP-420 is sealed because a complete currently effective objective
map was not established from the permitted evidence. Undated outlines use clearly labelled retrieved-content versions,
not invented effective dates. Other mapped credentials without a reviewed
package remain sealed even when their identity and current outline are verified.

### Playable content in this revision

| Dungeon                         | Playable verified encounters | Modes                           |
| ------------------------------- | ---------------------------: | ------------------------------- |
| DP-700: The Fabric Depths       |                          162 | Study and Boss Gauntlet         |
| DP-800: The Database Deeps      |                           27 | Study                           |
| AZ-104: The Infrastructure Keep |                           30 | Study                           |
| SC-200: The Sentinel Watch      |                           30 | Study                           |
| AI-103: The AI Workshop         |                           30 | Study                           |
| GH-300: The Copilot Spire       |                          149 | Study and Boss Gauntlet         |
| GH-600: The Agentic Workshop    |                            0 | Sealed: availability unverified |

**428 playable verified encounters**. GH-300 retains three rejected duplicates
and three manual-review records outside gameplay. GH-600 has **136 fully
three-pass-reviewed questions** and 13 rejected candidates, but none can enter
gameplay until its availability gate is resolved. All major floors are sampled;
the smaller AZ-104, SC-200, and AI-103 banks deliberately retain subskill gaps
and keep their gauntlets locked. GH-600 remains sealed while its current
availability cannot be verified from the permitted evidence. The other
unready catalog entries also remain sealed. See the
[GitHub expansion report](docs/github-expansion-report.md) for the current
three-pass results, source evidence, exact coverage, and remaining gaps. The
[initial dungeon implementation report](docs/dungeon-implementation-report.md)
records the earlier platform baseline.

### DP-800 / DP-420 work on this branch

**DP-800 Study is open with 27 independently verified original encounters.**
All 27 completed separate generation, technical verification and adversarial
review, meet the unchanged 44/48 rubric gate, and cover all three major objective
areas. The effective map is **March 12, 2026**; the source manifest's latest
retrieval is **September 14, 2026, 23:41:04 UTC**, and the latest independent
question review is **September 15, 2026, 04:27:57 UTC**. This is a limited,
build-time-grounded bank, not an always-current assessment.

The **150-question target is still in progress**. Boss remains locked below its
75-question minimum. The reviewed Advanced pool currently has four distinct
questions, so a five-question Advanced request is visibly capped at four.
Earlier rejected and manual-review versions remain archived; their authored
repairs restarted all three passes rather than inheriting approval.

DP-420 retains a null current objective version. Its retrieved **October 6,
2026** outline is prospective and stored outside gameplay; both modes remain
locked. This is an unresolved current-map/content gap, not a claim that the
credential itself is future-only.

See the [expansion progress and historical blocked report](docs/dp-expansion-report.md) for exact
counts, executed checks, outstanding acceptance gates and source evidence, and
[DP content maintenance](docs/dp-content-maintenance.md) for the resume workflow.
Local checkpoints preserve the original failing gates and subsequent genuine
Study release. Target expansion and final acceptance are not complete; nothing
has been pushed.

![The Certification Dungeon map with original castle artwork, hero-class selection, and five open dungeons](docs/screenshots/dungeon-map.png)

## Features

- Single-select, multi-select, true/false, scenario, and code interpretation.
- Beginner through expert difficulty, plus adaptive practice.
- Concept recall, implementation, scenarios, troubleshooting, and architecture.
- Select all, one, or several domains, specific skills/subskills, or weak topics.
- Random, study-guide, weakest-first, and weighted exam-style question order.
- Immediate answers, explanations only, deferred answers, study coaching, and exam mode.
- Optional per-question or full-session countdown; flags and unanswered questions.
- Technical explanations, individual distractor rationales, and direct official citations.
- Score breakdowns by domain, skill, subskill, difficulty, and complexity.
- Evidence-based recommendations, missed-question retries, and weak-area practice.
- JSON and printable HTML result exports, and locally saved recent results.
- Unseen-question preference, concept diversity, and a separately resettable question history.
- Contextual Dungeon Master reactions with Full, Balanced, Reduced, and Silent settings.
- Dark/light/system themes, reduced motion, and keyboard operation.

### DP-700: The Fabric Depths

The preserved DP-700 bank contains **162 independently reviewed questions**:
**54 per objective domain**, with **30 Beginner, 42 Intermediate, 54 Advanced,
and 36 Expert** questions. Advanced and Expert make up **55.6%** of the bank.
There are **0 manual-review-required, rejected, or stale** records in this revision.
All **10 skills and 54 measured subskills** have at least one primary question;
that is sampled coverage, not exhaustive mastery or an exam-readiness guarantee.

Last Learn MCP grounding: **2026-09-11T17:57:55.860Z**. Latest independent review
finalization: **2026-09-11T18:30:09.514Z**. Source and question records preserve
their individual real retrieval/review times. See the
[readable coverage report](src/content/exams/dp-700/content-coverage.md) and
[machine-readable report](src/content/exams/dp-700/question-bank-report.json) for distributions,
source counts, editorial warnings, and any future review queue.
The report keeps **124 nonblocking heuristic warnings across 92 verified
questions** visible for editorial inspection (for example, pronouns or scenario
negation). These were assessed in the independent reviews; they are not 92
unverified questions. This revision has no blocking duplicates or citation errors.

Filters may produce fewer questions than requested; setup shows the available
number before starting. Questions and concept IDs are not duplicated to fill a
quota. Weighted selection respects the current guide's domain ranges when
feasible and discloses constraints. This is not a reproduction of the certification exam.

## Stack and architecture

React 19, strict TypeScript, Vite, React Router, lightweight CSS, Lucide icons,
Zod, Vitest, React Testing Library, Playwright, and axe-core.

```text
src/
  content/
    credentials/          Reviewed credential catalog and generic hero classes
    exams/<credential>/   Manifest, objectives, facts, sources, reviews, rubrics, DM extensions
    personality.json      Shared Dungeon Master message catalog
  components/             Shared accessible UI and documentation surfaces
  pages/                  Map, tavern, forge, setup, play, results, review, settings
  features/
    dungeons/             Package registry, readiness, identity and source policies
    grounding/            Runtime content schemas and taxonomy extraction
    quiz/                 Pure selection/timing engine, state, configuration
    results/              Pure scoring and recommendations
    personality/          Context matching and seeded repetition protection
  services/               Local storage and safe exports
  styles/                 Responsive light/dark presentation
scripts/                  MCP retrieval and content validation/reporting
tests/                    Unit, interaction, and browser tests
docs/                     Coverage and maintainer documentation
.vscode/mcp.json           Microsoft Learn MCP connection
.github/copilot-instructions.md
```

The browser validates dungeon packages before allowing a run. UI, selection,
scoring, content validation, persistence, and exports are separate. Questions and
source metadata ship in the static bundle. There is no backend, URL proxy, live
model provider, or browser-to-MCP request.

The factual DP-700 files were moved without rewriting questions or their
independent-review fingerprints. Each encounter also has a content-bound
evidence envelope and an independently assessed ten-criterion realism rubric.
The minimum is 18/20, with full marks required for accuracy, answer uniqueness,
and documentation strength, and no zero-scored criterion. These are human or
independent-reviewer judgments, never scores inferred from JSON field presence.
Rubric records independently bind the reviewed objective-map version and
fingerprint, so changing a version label alone cannot reopen old content.

[Architecture](docs/architecture.md) · [Dungeon onboarding](docs/dungeon-onboarding.md) ·
[Hero classes](docs/hero-classes.md) · [Scoring and readiness](docs/dungeon-scoring.md) ·
[Lifecycle](docs/dungeon-lifecycle.md) · [Source policy](docs/source-policy.md) ·
[Theme/fact separation](docs/theme-fact-separation.md)

## Commands

| Command                                       | Purpose                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm install`                                 | Install dependencies from the manifest/lockfile                                                                |
| `npm ci`                                      | Reproducible clean installation for CI                                                                         |
| `npm run dev`                                 | Local Vite development server                                                                                  |
| `npm run lint`                                | ESLint, TypeScript rules, and React Hooks rules                                                                |
| `npm run typecheck`                           | Strict TypeScript checking                                                                                     |
| `npm run test`                                | Unit and component tests, one run                                                                              |
| `npm run test:coverage`                       | Unit coverage, including HTML in `coverage/`                                                                   |
| `npm run test:e2e`                            | Chromium desktop/mobile browser journeys and accessibility                                                     |
| `npm run validate`                            | Reject malformed, misaligned, duplicate, or uncited questions                                                  |
| `npm run validate:sources`                    | Offline citation and manifest validation                                                                       |
| `npm run validate:sources -- --online`        | Additionally check direct Learn sources online                                                                 |
| `npm run content:report`                      | Generate content coverage information                                                                          |
| `npm run content:report -- --write`           | Update the selected package's checked-in coverage report                                                       |
| `npm run format`                              | Format source and documentation with Prettier                                                                  |
| `npm run format:check`                        | Check formatting without modifying files                                                                       |
| `npm run build`                               | Validate content, check types, and build `dist/`                                                               |
| `npm run preview`                             | Serve the production build locally                                                                             |
| `npm run questions:generate`                  | Scaffold a maintainer request and reusable Copilot prompts; does not generate questions by itself              |
| `npm run questions:validate`                  | Validate the bank, citations, objective mappings, and playable status                                          |
| `npm run questions:coverage`                  | Report verified-only coverage, targets, and gaps                                                               |
| `npm run questions:duplicates`                | Check exact/near duplicates and report editorial quality warnings                                              |
| `npm run questions:verify`                    | Validate recorded independent reviews and content fingerprints, without inventing verification                 |
| `npm run reviews:sync`                        | Copy already-authored matching package attestations into the consolidated audit ledger; never create approvals |
| `npm run questions:report -- --write`         | Write readable and machine-readable question-bank reports                                                      |
| `npm run credentials:discover`                | Inspect discovery/scaffolding state; never auto-verify a credential                                            |
| `npm run credentials:validate`                | Validate identities, dates, class mappings, and sealed states                                                  |
| `npm run objectives:refresh -- --exam dp-700` | Prepare a controlled objective refresh                                                                         |
| `npm run content:validate-all`                | Validate every installed package, ledger, rubric, and readiness gate                                           |
| `npm run content:status`                      | Report package readiness and locked reasons                                                                    |
| `npm run sources:validate -- --exam dp-700`   | Validate the selected credential's official-source policy                                                      |

Question commands accept `--exam <credential-id>`; omitted exam selection
defaults to DP-700 for existing maintainer workflows. For example:

```powershell
npm run questions:generate -- --exam dp-700 --count 6 --difficulty advanced,expert
npm run questions:verify -- --exam dp-700
npm run questions:coverage -- --exam dp-700
npm run content:validate-all
```

Install the browser once before running end-to-end tests:

```powershell
npx playwright install chromium
npm run test:e2e
```

On Linux CI, use `npx playwright install --with-deps chromium`.
Browser tests build the production app and start their own loopback-only Vite
preview instance at `/The-Certification-Dungeon/`, matching the GitHub Pages project
path. They cover launch, navigation, refresh, quizzes, exports, local storage,
and accessibility. Chromium is a test dependency, not a requirement for end users;
use a modern browser to study.

Production build:

```powershell
npm run build
npm run preview
```

Vite's preview server is for local inspection, not an internet-facing production
server. To distribute the static build, serve `dist/` using any static HTTPS host.
Relative asset URLs and hash navigation (such as `/#/setup`) support both a domain
root and a project subdirectory without server-side SPA rewrites. Do not open
`index.html` with `file://`. Docker is intentionally not included.

## GitHub Pages deployment

Deployment is enabled in [the Quality gates workflow](.github/workflows/ci.yml)
with the repository variable `PAGES_ENABLED` set to `true` and GitHub Pages
configured to use GitHub Actions. Making a repository public does not enable
Pages or publish the app by itself.

To restore hosting or configure a copy of this repository:

1. Use a public repository for GitHub Free, or an eligible paid plan for a private repository.
2. In repository **Settings > Pages > Build and deployment**, select **GitHub Actions** as the source.
3. In **Settings > Secrets and variables > Actions > Variables**, add a repository variable named `PAGES_ENABLED` with the value `true`. This is a deployment switch, not a secret or browser setting.
4. Open **Actions > Quality gates > Run workflow**, select `main`, and run it.
5. After **Deploy browser app** succeeds, open the site's URL shown in **Settings > Pages**. For this repository, it is the launch link above; copies need their own README launch URL.

Subsequent pushes to `main` publish automatically after the quality gates pass.
Pull requests and manual runs on other branches never deploy. Only the built
`dist/` files are deployed. GitHub hosts the static files, while all quiz execution
and study storage remain browser-side.
The workflow uses GitHub's deployment token, not a personal access token.

Routes can be bookmarked, for example
[challenge setup](https://marcbushong.github.io/The-Certification-Dungeon/#/setup).
Saved results are available only in the browser profile that created them.
Local development and the hosted site use separate browser storage; local results
do not automatically move to the hosted app. Reloading an unfinished quiz still
discards that in-memory session.

## Microsoft Learn MCP configuration

Open the repository in a current VS Code with GitHub Copilot Chat and MCP support.
The checked-in `.vscode/mcp.json` declares:

```json
{
  "servers": {
    "microsoft-learn": {
      "type": "http",
      "url": "https://learn.microsoft.com/api/mcp"
    }
  }
}
```

Use VS Code's **MCP: List Servers** command to inspect/start this server and
approve it if prompted. Tool names are discovered at connection time; the
current server advertises `microsoft_docs_search`, `microsoft_docs_fetch`, and
`microsoft_code_sample_search`.

The included **maintainer-only** CLI also uses the official MCP TypeScript SDK,
initializes a Streamable HTTP connection, lists tools, and calls the discovered
documentation tool. No authentication or secret is needed for this public
server. See the official [MCP overview](https://learn.microsoft.com/en-us/training/support/mcp)
and [developer reference](https://learn.microsoft.com/en-us/training/support/mcp-developer-reference).

Do not navigate to the MCP endpoint as a web page or add a browser fetch
workaround; a normal browser GET can return 405.

## Grounding, not runtime generation

For Microsoft credentials, Copilot retrieves the authoritative guide,
certification, course, and supporting documentation through Microsoft Learn MCP.
GitHub credentials use official GitHub competency outlines and product
documentation, with directly relevant Learn preparation material where appropriate.
Original questions are written
from the retrieved evidence and linked to source records. **MCP retrieves
documentation; it does not generate questions.**

Raw MCP responses are kept in the ignored `.grounding/` maintainer workspace,
not embedded in the app. Versioned manifests preserve citations, retrieval and
review timestamps, objective alignment, feature status, and short paraphrased
supporting summaries. The application runs on that reviewed bank, not live
runtime generation. There is no configured or enabled dynamic provider.

Generation and verification are separate passes. An author first creates a
candidate from retrieved documents. A different reviewer then evaluates the
finished scenario, each answer choice, the explanations, code, constraints, and
feature status against the evidence. The committed
per-package `verification-reviews.json` records those
reviews and fingerprints the exact reviewed content. A changed answer, scenario,
or citation requires another review; a successful build cannot silently reuse
the old attestation.
The consolidated [`src/data/verification-reviews.json`](src/data/verification-reviews.json)
retains those same independently authored records across all dungeons. Default
verification and builds require it to agree with the packages. After integrating
real reviews, `npm run reviews:sync` copies them verbatim; it does not manufacture
an attestation, score, rationale, or date.

Only `verified` questions with complete, current review metadata enter gameplay.
`candidate`, `manual-review-required`, `rejected`, and `stale` questions remain excluded.
The credential must also be verified active, its current objectives must match
the encounter envelope, and the realism/readiness gates must pass.
Newer source-review timestamps make affected questions stale until re-reviewed.
Freshness is change-driven, not a guarantee that a fixed-age question is correct:
maintainers still need to retrieve current documentation and record changes.

Structural validation cannot prove a technical explanation is true. Online
validation proves reachability, not agreement with a claim. Maintainers must
read the retrieved passages and review **both the correct answer and every
distractor**. Unclear or conflicting evidence means excluding a question, not
inventing a resolution. Preview-dependent questions must be labelled Preview.

## Refreshing the guide and bank

1. Start a Copilot content-refresh session and follow `.github/copilot-instructions.md`.
2. Retrieve the latest guide, certification, and course through Learn MCP.
3. Extract a candidate taxonomy; compare effective dates, domains, weights, skills, and subskills.
4. Search for direct product documentation and fetch full supporting pages, including code samples when applicable.
5. Review affected questions, paraphrase evidence, and update manifests and validation dates only for content actually reviewed.
6. Run all content checks, regenerate the coverage report, and review the diff before committing.

Copy-ready retrieval examples (use new output names on subsequent refreshes):

```powershell
npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700" ".grounding\guide-refresh.json"
npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/" ".grounding\cert-refresh.json"
npm run grounding:retrieve -- fetch "https://learn.microsoft.com/en-us/training/courses/dp-700t00" ".grounding\course-refresh.json"
npm run grounding:taxonomy -- ".grounding\guide-refresh.json" ".grounding\objectives.candidate.json"
npm run grounding:retrieve -- search "Microsoft Fabric lakehouse table maintenance OPTIMIZE" ".grounding\maintenance-search.json"
npm run grounding:retrieve -- code "Microsoft Fabric PySpark Delta table maintenance" ".grounding\maintenance-code.json"
npm run validate
npm run validate:sources -- --online
npm run content:report -- --write
```

Retrieval scripts refuse to overwrite evidence files. Taxonomy extraction fails
if expected study-guide headings change; inspect the current source and update
the parser deliberately. A new candidate does **not** automatically replace the
active taxonomy or certify existing content against changed objectives.

The certification/course pages can contain client-rendered training placeholders.
Use Learn search to retrieve the actual relevant self-paced paths/modules;
never invent content from a `Loading...` placeholder.

## Adding a question

### GH-300 and GH-600: stricter three-pass workflow

These packages require grounded generation, independent technical verification,
and a separate adversarial challenge. A technically approved candidate still
cannot play until the adversarial pass and its realism rubric pass. Every
stage binds the exact question and objective-map fingerprints; a repair restarts
all three stages instead of copying old approvals.

The approved source registry is restricted to the current official Learn guide,
its linked self-paced Learn training, and official documentation directly linked
or clearly referenced by those materials. A matching hostname or a merely related
article is not enough. The registry preserves source class, objective relevance,
actual retrieval/curation dates, and the complete guide/training provenance chain.
Search summaries, blogs, videos, forums, unofficial banks, and internal materials
are not question sources.

Adversarial records examine scope, plan, role, prerequisites, feature status,
source changes, stem sufficiency, explanation limits, reasoning depth, and answer
clues. Each option records its represented claim, why it is wrong in context
(or why the correct option is supported), when it could be correct, sources,
and a concise evidence summary.

The version-2 rubric has 12 criteria scored 0-4. Its configured minimum is
**44/48**, with 4 required for accuracy, answer uniqueness, documentation
strength, and citation specificity; distractor evidence must score at least 3.
This is separate from the preserved DP-700 rubric. Scores are independently
reviewed judgments, not model-confidence percentages or field-presence checks.

```powershell
npm run objectives:refresh -- --exam gh-300
npm run questions:generate -- --exam gh-300 --target-verified 150
npm run questions:verify -- --exam gh-300
npm run questions:validate -- --exam gh-300
npm run questions:duplicates -- --exam gh-300 --cross-exam gh-600,dp-700
npm run questions:coverage -- --exam gh-300
npm run questions:report -- --exam gh-300 --write
npm run sources:validate -- --exam gh-300 --online
```

Use `gh-600` for the independent agentic package. These CLI aliases resolve to
the existing stable `github-copilot` and `github-agentic-ai-developer` package
IDs, preserving local history rather than creating duplicate dungeons. The
150-question value is a content-development target, never an official exam fact.
Generation commands create maintainer requests, not AI-generated answers.

See [the three-pass workflow](docs/gh-three-pass-workflow.md) for quarantine,
repairs, source refresh, rubric scoring, and reviewed-versus-playable reporting.

### Existing maintainer workflow

Read the [question-bank maintenance guide](docs/question-bank-maintenance.md)
and `src/features/grounding/schema.ts`. Start a small, reviewable batch:

```powershell
npm run questions:generate -- --exam dp-700 --author maintainer --count 6 --difficulty advanced,expert --output ".grounding\next-batch"
```

This creates a machine-readable request and copies the
[generation](.github/prompts/generate-dp700-questions.prompt.md) and
[independent verification](.github/prompts/verify-dp700-questions.prompt.md)
prompts. Run them with Copilot and the Microsoft Learn MCP server after retrieving
the primary pages and supporting articles. The command itself is deterministic
scaffolding, not an AI generator. Input/output schemas are in [`schemas/`](schemas/).
There is no paid runtime model dependency and no credential belongs in the browser.

Keep candidates excluded until a separate reviewer has completed the per-option
attestation. Merge reviewed questions, source records, and their attestations
together, then run:

```powershell
npm run reviews:sync
npm run questions:validate
npm run validate:sources -- --online
npm run questions:duplicates
npm run questions:verify
npm run questions:coverage
npm run questions:report -- --write
npm run test
npm run build
```

Reports include the review queue and reasons for excluded content. Review or
remove unsupported claims instead of changing a status just to make a check pass.

| Field                                            | Requirement                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `id`, `question`                                 | Unique stable ID and original applied question text                      |
| `questionType`                                   | `single-select`, `multi-select`, `true-false`, `scenario`, or `code`     |
| `answerChoices`                                  | Two to six distinct `{ id, text }` choices                               |
| `correctAnswer`                                  | Array of choice IDs; one except for multi-select                         |
| `explanation`, `deepExplanation`                 | Concise explanation and deeper technical rationale                       |
| `whyOtherAnswersAreWrong`                        | Object keyed by **every distractor ID**, and no correct IDs              |
| `objectiveDomain`, `skill`, `subskill`           | Exact IDs/text from `objectives.json`                                    |
| `difficulty`                                     | `beginner`, `intermediate`, `advanced`, or `expert`                      |
| `complexity`                                     | One of the five values in the schema; `mixed` is a session setting       |
| `sourceIds`, `sourceUrls`, `documentationTitles` | Nonempty, aligned one-to-one with manifest records                       |
| `generatedAt`, `lastValidatedAt`                 | Actual ISO 8601 UTC timestamps                                           |
| `featureStatus`                                  | `GA` or `Preview`                                                        |
| `tags`                                           | Nonempty descriptive topic tags                                          |
| `codeLanguage`, `codeSnippet`                    | Required together for code questions                                     |
| `conceptId`                                      | Stable identifier for the factual concept, not a renamed scenario        |
| `verificationStatus`, `requiresManualReview`     | Only `verified` with `false` is eligible for normal gameplay             |
| `verifiedAt`, `sourceLastReviewedAt`             | Actual independent-review time and the latest cited source-review time   |
| `verifiedAgainstSourceIds`                       | Exact set of cited source IDs covered by the review                      |
| `verificationNotes`, `confidenceReason`          | Evidence-specific reasoning, not a model-generated confidence percentage |

Sources require `sourceId`, title, a direct HTTPS URL approved for the credential,
retrieval/review dates, applicable domain and skill IDs, feature status, and
supporting summary. No search URLs, arbitrary external hosts, ambiguous preview
status, empty citations, or guide-only evidence for product behavior.
GitHub technical evidence must come from the selected package's explicit
official-source policy, not a community post or a Microsoft article on a merely
similar feature.

Duplicate checks normalize text and choice ordering, inspect code similarities,
and compare concept IDs. Editorial warnings also identify answer-length bias,
repeated positions/openings, negative wording, absolutes, and possible semantic
overlap. These heuristics cannot establish semantic uniqueness or factual truth:
the independent reviewer must adjudicate them against the actual documentation.
Never rename a concept ID merely to evade a warning.

## Scoring and adaptive practice

A correct answer earns **1 point**; incorrect or unanswered earns **0**.
Multi-select earns credit only for the exact complete set, without duplicates.
There is no partial credit and no time-based penalty or bonus. Scores are local
practice percentages, **not Microsoft's scaled certification scores**.

Timers use elapsed wall-clock time, so background-tab interval throttling cannot
extend a deadline. Per-question expiry locks that question as unanswered.
Full-session expiry completes the session and leaves unvisited questions
unanswered. Submissions are locked and repeated timer events cannot duplicate
results. The full-session clock includes time spent viewing feedback.

Adaptive mode begins near Intermediate when fewer than three matching historical
responses are available. Otherwise it considers up to 20 recent matching
responses: each contributes its difficulty index plus one for a correct answer
or minus one otherwise, and the rounded mean is clamped to the supported levels.
During play, three consecutive correct or incorrect responses at the same actual
difficulty move the target one level. Alternating outcomes do not move it after
each answer. The next question is the closest available difficulty within the
next planned domain's remaining preselected questions. This preserves domain
allocation; it does not add questions, override filters, or estimate calibrated
ability. Study-guide order may reorder skills within the planned domain when
adaptive practice is enabled.

Selection prevents repeated IDs and concept IDs within a session and prefers
questions outside the recent-question history when the available pool permits.
Weighted exam-style selection uses integer domain quotas within the study
guide's ranges when feasible. Small sessions, filters, or concept availability
can make that impossible; setup reports the limitation. Random order is not
advertised as domain-balanced, and seen questions are never permanently hidden.

Weak-area selection uses missed topics in the most recent 20 saved sessions.
No misses/history means a disclosed general-practice fallback. Results compare
only sampled topics. Categories with fewer than five questions carry a small
sample warning; a broader performance label requires at least 15 questions and
five in each current domain. Even this is **not an exam-readiness prediction**.

## Dungeon Master personality

DM Chattiness offers **Full**, **Balanced**, **Reduced**, and **Silent**.
The choice affects the entire host, not just correct-answer feedback. Technical
results, explanations, citations, and scoring never depend on the amount of humor.
Legacy reduced-banter preferences are migrated without discarding saved results.

Structured message pools use categories and metadata for domain, difficulty,
streak, tone, intensity, themes, and direct reduced-banter wording. Context
distinguishes ordinary answers, partial multi-select attempts, timeouts, recovery,
expert questions, documentation, retries, weak-area practice, and results.
Partial multi-select reactions do **not** introduce partial-credit scoring.
The shared JSON catalog supplies genuine context-specific lines, while dungeon
packages add their own boss and biome reactions. Infrastructure, networking,
security, data, AI, DevOps, GitHub, and other public product themes are kept
separate from factual questions and citations.
There are **278 original lines**: **242 shared** and **36 dungeon-specific boss
extensions**, across **29 categories and 16 themes**. The main pools contain 35
correct, 35 incorrect, 15 streak, 15 timeout, 20 completion, 10 documentation,
and 10 weak-practice reactions, with additional tome, cursed-chamber, boss, and
floor-clear categories.

The selection engine remembers recent message IDs, openings, and joke themes,
and avoids repetition when alternatives exist. The default category-exhaustion
threshold is 80%, with bounded theme/opening windows and a finite small-pool fallback.
Balanced shows answer and summary reactions; Reduced uses mild wording every
fourth answer and in summaries; Full also enables contextual events; None disables
all reactions. Seeded tests make choices
reproducible; session boundaries reset message history. Screen-reader feedback
prioritizes the answer result and explanation, not a live announcement of the joke.
To add reactions, follow [personality authoring](docs/personality-authoring.md),
edit the shared or per-dungeon JSON catalog, and assign
unique IDs and accurate context metadata, and include a mild direct alternative.
Keep humor out of technical definitions, code, and citations.

## Local data, privacy, and exports

Study preferences, completed sessions, favorites, the chosen hero class, and up
to **200 recently shown question IDs per dungeon** are stored under
`fabric-challenge:v1` in this browser's localStorage. The migration preserves
the existing DP-700 history and removes the old 30-result truncation for new
runs. Configurations and recent-question lists are credential-scoped. Results include
question snapshots so later bank updates cannot silently rescore history.
In-progress quizzes are held in memory: **reloading loses an unfinished session**.
Question history records questions actually shown, not unused preselected items.
Use **Reset question history** in Settings to reset unseen-question preference
without removing saved scores or preferences. Retrying an older result uses the
matching currently verified bank entries, not obsolete historical answer keys;
historical review and scoring still use the original snapshots.

New runs record each encounter's credential, objective version, grounding time,
and objective-map snapshot. Older records remain tagged `dp-700` with an
explicitly unknown legacy objective version when that version was never saved.
See [storage migration](docs/storage-migration.md); current objectives are never
substituted for missing historical evidence.

No telemetry, sign-in, cookies for tracking, external database, or third-party
model calls are enabled. LocalStorage is not encrypted; anyone using the same
browser profile may access these results. Private browsing and storage limits
can prevent persistence; the app displays failures rather than pretending a
save succeeded. JSON exports contain your study answers and timestamps.

Use **Clear Local Data** in Settings to remove this application's saved settings
and results without deleting unrelated site storage. Downloaded exports are
separate files and must be removed yourself. Export JSON for structured data or
printable HTML for a readable report; open the downloaded HTML and use your
browser's Print command to print or save as PDF.

Opening a documentation link contacts its official documentation host using your browser.
The link is opened with `noopener noreferrer`. Browser content is rendered as
text/React, not arbitrary HTML; exports escape text and validate source URLs.
No browser API keys or runtime `.env` files are needed.
Never introduce secrets into frontend configuration.

## Accessibility

Semantic landmarks and headings, labelled native form controls, keyboard
navigation, visible focus, skip navigation, accessible dialogs, and textual
score breakdowns support assistive technologies. Correct/incorrect feedback
uses words and icons as well as color. Dark, light, system, forced-color, and
reduced-motion settings are supported. Banter can be disabled independently.

Browser journeys include automated axe checks for critical screens. Automated
checks do not replace manual screen-reader testing or constitute an accessibility
certification.

## Troubleshooting

| Symptom                            | Action                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Node/Vite syntax or engine error   | Use Node 22.12+; Node 22 LTS is recommended                                                 |
| `npm` is not found                 | Install Node and reopen the terminal                                                        |
| Port is in use                     | Use Vite's printed alternative port, or `npm run dev -- --port 5174`                        |
| Few or zero matching questions     | Broaden skill, format, difficulty, or domain filters                                        |
| Saved data warning                 | Export results, check browser storage permissions, then clear app data                      |
| Missing Playwright executable      | Run `npx playwright install chromium`                                                       |
| MCP returns 405 in browser         | Use Copilot MCP tools or the included SDK CLI, not browser navigation                       |
| MCP tool/schema changed            | Discover tools and review the client; do not fabricate successful output                    |
| Source check fails offline         | Retry when online; do not claim a fresh source review                                       |
| Invalid bank blocks startup/build  | Correct the reported schema, duplicate, taxonomy, or citation error                         |
| GitHub Pages launch link gives 404 | Enable Pages with GitHub Actions, set `PAGES_ENABLED=true`, and run Quality gates on `main` |
| Direct hosted route gives 404      | Use the app's hash link, such as `/The-Certification-Dungeon/#/setup`                       |
| Unfinished session disappeared     | Reload resets in-memory play; only completed results persist                                |

## Contributing, license, and limitations

Keep changes focused and accessible. Include engine/UI tests for behavior
changes and direct evidence for content changes. Run lint, typecheck, tests,
validation, browser journeys, and the production build before proposing a change.
CI applies the same quality gates.

Sampling every measured subskill does not exhaust its depth. Technical content
has a specific last-reviewed date and can go stale. There is no live content
refresh, cloud sync, account recovery, exam simulation guarantee, or supported
runtime AI provider. SQL/PySpark/KQL examples are teaching snippets, not executed
against a Fabric capacity by this app. Because this is a local client-side app,
the bundled answers can be inspected in developer tools; exam mode controls
feedback visibility, not proctoring or anti-cheating security.

**License guidance:** no project license has been selected. The repository owner
should choose and add a license before distributing the code or question bank.
Linked Microsoft documentation remains subject to its own terms. Microsoft,
Microsoft Fabric, Microsoft Learn, GitHub Copilot, and related marks belong to
their respective owners; this project does not grant rights to those marks.

Questions are original and based on public documentation. This application does
not contain actual exam questions, leaked questions, exam dumps, or copied
practice assessments. Verify answers through the linked Microsoft Learn pages.
