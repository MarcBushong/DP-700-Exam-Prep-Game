import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  Flag,
  Flame,
  RotateCcw,
  Target,
  Trophy,
} from 'lucide-react';
import { useGame } from '../features/quiz/context';
import { isPlayableQuestion } from '../features/grounding/schema';
import { eligibleQuestions, feedbackVisibility } from '../features/quiz/engine';
import {
  defaultConfig,
  labels,
  type SessionResult,
  type QuizConfig,
} from '../features/quiz/types';
import {
  missedQuestions,
  scoreSession,
  type CategoryScore,
} from '../features/results/scoring';
import { downloadFile, resultHtml, resultJson } from '../services/export';
import {
  CodeSnippet,
  FlagLabel,
  QuestionExplanation,
  QuestionMetadata,
  QuestionSources,
} from '../components/QuestionContent';
import {
  ConfirmDialog,
  DateStamp,
  EmptyState,
  LearnLink,
  PageHeading,
} from '../components/common';
import { useReaction } from '../features/personality/useReaction';
import {
  domainCategory,
  scoreCategory,
  type ReactionContext,
} from '../features/personality/reactions';
import { HostReaction } from '../features/personality/HostReaction';
import { DocumentationReactions } from '../features/personality/DocumentationReactions';
import { credentials } from '../features/dungeons/catalog';
import { getDungeonPackage } from '../features/dungeons/packages';
import { questionOrigin, LEGACY_CREDENTIAL_ID } from '../features/quiz/origins';

function DomainReaction({
  resultId,
  row,
}: {
  resultId: string;
  row: CategoryScore;
}) {
  const reaction = useReaction(
    resultId,
    `domain:${row.id}`,
    [domainCategory(row.percentage)],
    {
      credentialId: row.credentialId,
      domainId: row.objectiveId ?? row.id,
      domain: row.label,
      floorId: row.objectiveId ?? row.id,
      floor: row.label,
    },
  );
  return <HostReaction reaction={reaction} />;
}

function useResult() {
  const { id } = useParams();
  const { lastResult, history } = useGame();
  return lastResult?.id === id
    ? lastResult
    : history.find((result) => result.id === id);
}

function MissingResult() {
  return (
    <>
      <PageHeading title="This result isn’t in this browser." />
      <EmptyState title="Let’s find your learning trail.">
        <p>
          Results are saved only on the browser you used, with the latest 30
          completed sessions retained. This result may have been cleared, aged
          out, or opened on another device.
        </p>
        <Link className="button primary" to="/">
          View saved sessions <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link className="text-link" to="/setup">
          Start a new challenge
        </Link>
      </EmptyState>
    </>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: CategoryScore[];
}) {
  return (
    <details className="breakdown">
      <summary>
        {title}
        <span>{rows.length} sampled</span>
      </summary>
      <div
        className="table-scroll"
        role="region"
        aria-label={`${title} breakdown`}
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">
            {title} performance. Fewer than five questions is a small sample.
          </caption>
          <thead>
            <tr>
              <th scope="col">Topic</th>
              <th scope="col">Correct / total</th>
              <th scope="col">Score</th>
              <th scope="col">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{labels[row.label] ?? row.label}</th>
                <td>
                  {row.correct} / {row.total}
                </td>
                <td>{row.percentage}%</td>
                <td>
                  {row.insufficient ? 'Small sample (<5)' : '5+ questions'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ResultsPage() {
  const result = useResult();
  if (!result) return <MissingResult />;
  return <ResultContent result={result} />;
}

function ResultContent({ result }: { result: SessionResult }) {
  const {
    taxonomy,
    history,
    active,
    startSession,
    selectDungeon,
    abandonSession,
  } = useGame();
  const primaryId =
    result.credentialId ?? result.config.credentialId ?? LEGACY_CREDENTIAL_ID;
  const credential = credentials.find(
    (item) => item.credentialId === primaryId,
  );
  const originIds = [
    ...new Set(
      result.questions.map(
        (question) => questionOrigin(result, question.id).credentialId,
      ),
    ),
  ];
  const bank = originIds.flatMap((id) =>
    getDungeonPackage(id)?.readiness.study
      ? getDungeonPackage(id)!.questions
      : [],
  );
  const reactionContext: ReactionContext = {
    runMode: result.config.runMode,
    inProgress: false,
    credentialId: originIds.length === 1 ? primaryId : undefined,
    dungeon: originIds.length > 1 ? 'Grand Raid' : credential?.dungeonName,
    themes: originIds.length > 1 ? ['cross-dungeon'] : undefined,
  };
  const [pending, setPending] = useState<'weak' | 'retry' | null>(null);
  const [downloadMessage, setDownloadMessage] = useState('');
  const navigate = useNavigate();
  const score = scoreSession(result, taxonomy);
  const summaryReaction = useReaction(
    result.id,
    'summary',
    ['session-complete'],
    reactionContext,
    'summary',
  );
  const scoreReaction = useReaction(
    result.id,
    'score',
    [scoreCategory(score.percentage)],
    reactionContext,
  );
  const timedOut = result.responses.some((response) => response.timedOut);
  const timeoutReaction = useReaction(
    result.id,
    'timeout-summary',
    ['time-expired'],
    reactionContext,
    'context',
    timedOut,
  );
  const missed = missedQuestions(result);
  const retryable = missed.flatMap((question) => {
    const current = bank.find(
      (candidate) =>
        candidate.id === question.id && isPlayableQuestion(candidate),
    );
    return current ? [current] : [];
  });
  const skills = [...new Set(missed.map((question) => question.skill))];
  const configurationFor = (ids: string[]): QuizConfig => ({
    ...defaultConfig,
    credentialId: ids[0] ?? primaryId,
    runMode: ids.length > 1 ? 'raid' : 'study',
    raidCredentialIds: ids.length > 1 ? ids : undefined,
  });
  const retryOrigins = [
    ...new Set(
      retryable.map(
        (question) => questionOrigin(result, question.id).credentialId,
      ),
    ),
  ];
  const weakOrigins = [
    ...new Set(
      missed.map(
        (question) => questionOrigin(result, question.id).credentialId,
      ),
    ),
  ].filter((id) => getDungeonPackage(id)?.readiness.study);
  const retryConfig = configurationFor(retryOrigins);
  const weakConfig = {
    ...configurationFor(weakOrigins),
    skills,
    order: 'weakest' as const,
    practiceMode: weakOrigins.length > 1 ? ('weak' as const) : ('all' as const),
  };
  const weakCount = skills.length
    ? weakOrigins.reduce(
        (total, id) =>
          total +
          eligibleQuestions(
            getDungeonPackage(id)?.questions ?? [],
            { ...weakConfig, credentialId: id },
            history,
          ).length,
        0,
      )
    : 0;
  const practice = (kind: 'weak' | 'retry') => {
    const config = kind === 'retry' ? retryConfig : weakConfig;
    if (!selectDungeon(config.credentialId ?? primaryId)) return;
    if (kind === 'retry') {
      if (
        retryable.length &&
        startSession(
          { ...retryConfig, questionCount: retryable.length },
          retryable,
        )
      )
        navigate('/play', { state: { practiceEvent: 'retry' } });
    } else if (
      weakCount &&
      startSession({ ...weakConfig, questionCount: Math.min(10, weakCount) })
    )
      navigate('/play', { state: { practiceEvent: 'weak' } });
  };
  const start = (kind: 'weak' | 'retry') => {
    if (active) setPending(kind);
    else practice(kind);
  };
  const exportResult = (format: 'json' | 'html') => {
    try {
      const filename = `certification-dungeon-${result.id.replace(/[^a-zA-Z0-9-]/g, '-')}.${format}`;
      downloadFile(
        format === 'json'
          ? resultJson(result, taxonomy)
          : resultHtml(result, taxonomy),
        filename,
        format === 'json' ? 'application/json' : 'text/html',
      );
      setDownloadMessage(
        format === 'html'
          ? 'Printable HTML downloaded. Open the file and use your browser’s Print command to print or save as PDF.'
          : 'Your JSON result download is ready.',
      );
    } catch (error: unknown) {
      setDownloadMessage(
        `The download couldn’t be created. ${error instanceof Error ? error.message : 'Try again in this browser.'}`,
      );
    }
  };
  return (
    <div className="results-page">
      <PageHeading
        title="Expedition complete."
        description="Honest scores. Documented lessons. Your next move."
      >
        <Link className="button secondary" to="/setup">
          New expedition <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </PageHeading>
      <section className="result-overview panel" aria-labelledby="result-score">
        <div className="result-score">
          <Trophy size={28} aria-hidden="true" />
          <h2 id="result-score">
            <strong>
              {score.percentage}
              <span>%</span>
            </strong>
            <span>In-game practice score</span>
          </h2>
          <p>
            {score.correct} of {score.total} questions correct
          </p>
        </div>
        <div className="result-summary">
          <h2>{score.mastery}</h2>
          <p>
            A useful learning signal, not a certification score or a prediction
            of passing. Every question carries equal weight; unanswered
            questions count toward the total.
          </p>
          <div className="result-counts">
            <div>
              <CheckCircle2 size={17} aria-hidden="true" />
              <strong>{score.correct}</strong>
              <span>Correct</span>
            </div>
            <div>
              <RotateCcw size={17} aria-hidden="true" />
              <strong>{score.incorrect}</strong>
              <span>Incorrect</span>
            </div>
            <div>
              <Clock3 size={17} aria-hidden="true" />
              <strong>{score.unanswered}</strong>
              <span>Unanswered</span>
            </div>
          </div>
        </div>
      </section>
      <section className="notice" aria-label="In-game readiness estimate">
        <strong>{score.readiness.label}</strong>
        <p>{score.readiness.explanation}</p>
        <p>
          {score.readiness.verifiedSampleSize}/{score.total} verified question
          snapshots · {Math.round(score.readiness.advancedShare * 100)}%
          Advanced/Expert · {score.readiness.freshness}
        </p>
        {score.readiness.warnings.length > 0 && (
          <ul>
            {score.readiness.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </section>
      <HostReaction reaction={summaryReaction} />
      <HostReaction reaction={scoreReaction} />
      <HostReaction reaction={timeoutReaction} />
      <dl className="result-stats">
        <div>
          <dt>
            <Clock3 size={18} aria-hidden="true" />
            Average response
          </dt>
          <dd>
            {(score.averageTimeMs / 1000).toFixed(1)}
            <span>s</span>
          </dd>
        </div>
        <div>
          <dt>
            <Flame size={18} aria-hidden="true" />
            Best streak
          </dt>
          <dd>{score.bestStreak}</dd>
        </div>
        <div>
          <dt>
            <Flame size={18} aria-hidden="true" />
            Ending streak
          </dt>
          <dd>{score.currentStreak}</dd>
        </div>
        <div>
          <dt>
            <Flag size={18} aria-hidden="true" />
            Flagged for review
          </dt>
          <dd>{score.flagged.length}</dd>
        </div>
      </dl>
      <section className="result-actions panel" aria-labelledby="next-step">
        <div>
          <h2 id="next-step">Make your next move.</h2>
          <p>
            {missed.length
              ? 'Revisit missed questions or practice the skills behind them.'
              : 'All correct in this sample. Explore more topics for broader coverage.'}
          </p>
        </div>
        <div className="actions">
          <Link className="button primary" to={`/review/${result.id}`}>
            <BookOpen size={17} aria-hidden="true" /> Review all answers
          </Link>
          <button
            className="button secondary"
            disabled={!retryable.length}
            onClick={() => start('retry')}
          >
            <RotateCcw size={17} aria-hidden="true" /> Retry missed (
            {retryable.length})
          </button>
          <button
            className="button secondary"
            disabled={!weakCount}
            onClick={() => start('weak')}
          >
            <Target size={17} aria-hidden="true" /> Revisit cursed chambers
          </button>
        </div>
        {missed.length > retryable.length && (
          <p className="small muted">
            {missed.length - retryable.length} saved question(s) are not
            currently verified for play. Their historical answers and citations
            remain available in review.
          </p>
        )}
        {missed.length > 0 && !weakCount && (
          <p className="small muted">
            No questions in the current bank match this result’s missed skills.
            Historical answers remain available in review.
          </p>
        )}
        {weakCount > 0 && (
          <p className="small muted">
            Cursed-chamber practice requests up to {Math.min(10, weakCount)}{' '}
            encounters{' '}
            {weakOrigins.length > 1
              ? 'from missed topics in each dungeon’s saved history. Balanced raid quotas may reduce the count.'
              : 'from the skills missed in this session, with unrelated filters cleared.'}
          </p>
        )}
      </section>
      <section className="result-domains" aria-labelledby="domain-performance">
        <div className="section-heading">
          <div>
            <h2 id="domain-performance">Your floor results</h2>
            <p>
              Less than 5 questions in a category? Treat it as a small sample,
              not mastery.
            </p>
          </div>
        </div>
        {score.byDungeon.map((dungeonScore) => {
          const snapshot =
            result.objectiveSnapshots?.[dungeonScore.credentialId];
          const dungeonCredential = credentials.find(
            (item) => item.credentialId === dungeonScore.credentialId,
          );
          const floors =
            snapshot?.domains ??
            dungeonScore.byDomain.map((item) => ({
              id: item.objectiveId ?? item.id,
              title: item.label,
              weightRange: null,
            }));
          return (
            <section
              key={dungeonScore.id}
              className="raid-result-grid"
              aria-label={`${dungeonCredential?.examCode ?? dungeonScore.id} results`}
            >
              <div className="section-heading">
                <div>
                  <h3>
                    {dungeonCredential?.examCode ?? dungeonScore.id} ·{' '}
                    {dungeonCredential?.dungeonName ?? 'Historical dungeon'}
                  </h3>
                  <p>
                    {dungeonScore.correct}/{dungeonScore.total} correct ·{' '}
                    {dungeonScore.percentage}% · {dungeonScore.domainsCovered}/
                    {dungeonScore.domainsTotal ?? '?'} documented floors sampled
                  </p>
                  <p className="small muted">
                    Objective version:{' '}
                    {dungeonScore.objectiveVersions.join(', ')}
                    {!snapshot &&
                      ' · No saved objective map; current objectives have not been substituted.'}
                  </p>
                </div>
              </div>
              <div className="domain-grid">
                {floors.map((domain) => {
                  const sampled = dungeonScore.byDomain.find(
                    (item) => item.objectiveId === domain.id,
                  );
                  return (
                    <article className="panel domain-result" key={domain.id}>
                      <span className="domain-weight">
                        {domain.weightRange
                          ? `${domain.weightRange.join('–')}% guide weight`
                          : 'Weighting not recorded'}
                      </span>
                      <h3>{domain.title}</h3>
                      {sampled ? (
                        <>
                          <div className="domain-result-score">
                            <strong>{sampled.percentage}%</strong>
                            <span>
                              {sampled.correct} / {sampled.total} correct
                            </span>
                          </div>
                          <progress
                            max={sampled.total}
                            value={sampled.correct}
                            aria-label={`${domain.title}: ${sampled.correct} of ${sampled.total} correct`}
                          />
                          <p className="small muted">
                            {sampled.insufficient
                              ? 'Small sample · insufficient to estimate mastery'
                              : 'Sampled performance · not a mastery guarantee'}
                          </p>
                          <DomainReaction resultId={result.id} row={sampled} />
                        </>
                      ) : (
                        <>
                          <p className="not-sampled">Not sampled</p>
                          <p className="small muted">
                            No questions from this domain. No score to estimate.
                          </p>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>
      <section
        className="panel detailed-results"
        aria-labelledby="breakdown-title"
      >
        <h2 id="breakdown-title">Look a little closer.</h2>
        <p className="muted">
          Performance across the topics and question styles you actually saw.
        </p>
        <BreakdownTable title="Skills" rows={score.bySkill} />
        <BreakdownTable title="Subskills" rows={score.bySubskill} />
        <BreakdownTable title="Difficulty" rows={score.byDifficulty} />
        <BreakdownTable title="Complexity" rows={score.byComplexity} />
        <BreakdownTable title="Question type" rows={score.byType} />
      </section>
      <div className="insights-grid">
        <section className="panel insights-panel">
          <h2>Keep building on this.</h2>
          <p className="muted">
            Strongest sampled skills, relative to this session.
          </p>
          <ul className="topic-score-list">
            {score.strongest.map((topic) => (
              <li key={topic.id}>
                <span>
                  {topic.label}
                  {topic.insufficient && <small>Small sample</small>}
                </span>
                <strong>
                  {topic.correct}/{topic.total}
                </strong>
              </li>
            ))}
          </ul>
          <h3>Worth another look</h3>
          {score.weakest.length ? (
            <ul className="topic-score-list">
              {score.weakest.map((topic) => (
                <li key={topic.id}>
                  <span>
                    {topic.label}
                    {topic.insufficient && <small>Small sample</small>}
                  </span>
                  <strong>{topic.percentage}%</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No missed skills in this sample. That doesn’t establish readiness
              across the full guide.
            </p>
          )}
        </section>
        <section className="panel recommendations">
          <h2>Your next reading list</h2>
          <p className="muted">
            Recommended from your actual missed or unanswered topics.
          </p>
          {score.recommendations.length ? (
            <DocumentationReactions scope={result.id} context={reactionContext}>
              <ol>
                {score.recommendations.map((recommendation) => {
                  const docs = new Map(
                    recommendation.questions.flatMap((question) =>
                      question.sourceUrls.map(
                        (url, index) =>
                          [url, question.documentationTitles[index]] as const,
                      ),
                    ),
                  );
                  return (
                    <li key={recommendation.id}>
                      <h3>{recommendation.label}</h3>
                      <p>
                        {recommendation.total - recommendation.correct} missed
                        of {recommendation.total} sampled
                        {recommendation.insufficient ? ' · small sample' : ''}
                      </p>
                      <ul>
                        {[...docs].map(([url, title]) => (
                          <li key={url}>
                            <LearnLink href={url}>{title}</LearnLink>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            </DocumentationReactions>
          ) : (
            <p>
              You have no missed-topic recommendations for this session.{' '}
              <LearnLink href={credential?.officialUrls.studyGuide ?? ''}>
                Explore the full study guide
              </LearnLink>{' '}
              for objectives you haven’t sampled.
            </p>
          )}
        </section>
      </div>
      <section className="export-section">
        <div>
          <h2>Take your progress with you.</h2>
          <p>
            Download your complete result. The HTML file is readable and
            printable in your browser.
          </p>
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => exportResult('json')}
            >
              <Download size={17} aria-hidden="true" /> Download JSON
            </button>
            <button
              className="button secondary"
              onClick={() => exportResult('html')}
            >
              <Download size={17} aria-hidden="true" /> Download printable HTML
            </button>
          </div>
          {downloadMessage && (
            <p role="status" className="notice">
              {downloadMessage}
            </p>
          )}
        </div>
        <dl className="result-dates">
          <div>
            <dt>Completed</dt>
            <dd>
              <DateStamp value={result.completedAt} precise />
            </dd>
          </div>
          <div>
            <dt>
              {result.config.runMode === 'raid'
                ? 'Starting dungeon content grounded'
                : 'Session content grounded'}
            </dt>
            <dd>
              <DateStamp value={result.groundedAt} precise />
            </dd>
          </div>
        </dl>
      </section>
      {pending && (
        <ConfirmDialog
          title="Replace your in-progress challenge?"
          confirmLabel="Replace & practice"
          onClose={() => setPending(null)}
          onConfirm={() => {
            abandonSession();
            practice(pending);
          }}
          destructive
        >
          <p>
            The unfinished challenge will be discarded without saving a result.
            This completed result will stay in your learning trail.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export function ReviewPage() {
  const result = useResult();
  if (!result) return <MissingResult />;
  return <ReviewContent result={result} />;
}

function ReviewContent({ result }: { result: SessionResult }) {
  const { taxonomy } = useGame();
  const [filter, setFilter] = useState('all');
  const [sourceQuestion, setSourceQuestion] = useState<string | null>(null);
  const score = scoreSession(result, taxonomy);
  const visibility = feedbackVisibility(result.config.answerMode, true, true);
  const rows = score.rows.filter(
    (row) =>
      filter === 'all' ||
      (filter === 'missed' ? !row.correct : row.response?.flagged),
  );
  const shownSource = result.questions.find(
    (question) => question.id === sourceQuestion,
  );
  return (
    <div className="review-page">
      <Link className="text-link" to={`/results/${result.id}`}>
        <ArrowLeft size={17} aria-hidden="true" /> Back to results
      </Link>
      <PageHeading
        title="Every answer. Every why."
        description="Your complete question snapshots, including skipped and unvisited questions."
      />
      <div className="review-toolbar">
        <div className="field">
          <label htmlFor="review-filter">Show questions</label>
          <select
            id="review-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All questions ({score.total})</option>
            <option value="missed">
              Missed or unanswered ({score.missed.length})
            </option>
            <option value="flagged">Flagged ({score.flagged.length})</option>
          </select>
        </div>
        <p role="status">
          {rows.length} of {score.total} questions shown
        </p>
      </div>
      {!rows.length && (
        <EmptyState title="Nothing in this view.">
          <p>No questions match this review filter.</p>
          <button className="button secondary" onClick={() => setFilter('all')}>
            Show all questions
          </button>
        </EmptyState>
      )}
      <DocumentationReactions scope={result.id}>
        <div className="review-list">
          {rows.map(({ question, response, correct, answered }) => (
            <article className="panel review-question" key={question.id}>
              <header className="review-question-header">
                <h2>
                  Question{' '}
                  {result.questions.findIndex(
                    (item) => item.id === question.id,
                  ) + 1}
                </h2>
                <span
                  className={`status-badge ${correct ? 'status-correct' : answered ? 'status-incorrect' : ''}`}
                >
                  {correct ? 'Correct' : answered ? 'Incorrect' : 'Unanswered'}
                </span>
                <FlagLabel flagged={Boolean(response?.flagged)} />
                <span className="small muted">
                  {response
                    ? `${(response.timeMs / 1000).toFixed(1)}s response${response.timedOut ? ' · timed out' : ''}`
                    : 'Not submitted'}
                </span>
              </header>
              <QuestionMetadata
                question={question}
                credentialId={questionOrigin(result, question.id).credentialId}
                objectiveVersion={
                  questionOrigin(result, question.id).objectiveVersion
                }
                taxonomySnapshot={
                  result.objectiveSnapshots?.[
                    questionOrigin(result, question.id).credentialId
                  ] ?? null
                }
              />
              <h3 className="review-question-title">{question.question}</h3>
              <CodeSnippet question={question} />
              <div className="review-answer">
                <strong>
                  Your answer
                  {(response?.selectedAnswer.length ?? 0) > 1 ? 's' : ''}
                </strong>
                <p>
                  {question.answerChoices
                    .filter((choice) =>
                      response?.selectedAnswer.includes(choice.id),
                    )
                    .map((choice) => choice.text)
                    .join(' · ') || 'Unanswered'}
                </p>
              </div>
              {visibility.explanation && (
                <QuestionExplanation
                  question={question}
                  selected={response?.selectedAnswer ?? []}
                  revealAnswer={visibility.answer}
                />
              )}
              {visibility.sources && (
                <div className="review-sources">
                  <button
                    className="button secondary"
                    onClick={() => setSourceQuestion(question.id)}
                  >
                    <BookOpen size={17} aria-hidden="true" /> Open tome ·
                    sources & objective alignment
                  </button>
                  <ul>
                    {question.sourceUrls.map((url, index) => (
                      <li key={url}>
                        <LearnLink href={url}>
                          {question.documentationTitles[index]}
                        </LearnLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      </DocumentationReactions>
      {shownSource && visibility.sources && (
        <QuestionSources
          question={shownSource}
          groundedAt={questionOrigin(result, shownSource.id).groundedAt ?? null}
          credentialId={questionOrigin(result, shownSource.id).credentialId}
          taxonomySnapshot={
            result.objectiveSnapshots?.[
              questionOrigin(result, shownSource.id).credentialId
            ] ?? null
          }
          reactionScope={result.id}
          onClose={() => setSourceQuestion(null)}
        />
      )}
    </div>
  );
}
