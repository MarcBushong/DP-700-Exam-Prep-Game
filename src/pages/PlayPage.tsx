import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Flag,
  Flame,
  Lightbulb,
  LogOut,
  SkipForward,
  Swords,
  Heart,
  Gem,
} from 'lucide-react';
import { useGame } from '../features/quiz/context';
import {
  feedbackVisibility,
  isCorrect,
  remainingSeconds,
} from '../features/quiz/engine';
import { labels, type ActiveSession } from '../features/quiz/types';
import { useNow } from '../hooks/useSessionTimer';
import { useQuestionFlag } from '../hooks/useQuestionFlag';
import {
  CodeSnippet,
  QuestionExplanation,
  QuestionMetadata,
  QuestionSources,
} from '../components/QuestionContent';
import { ConfirmDialog, EmptyState, LearnLink } from '../components/common';
import { useReaction } from '../features/personality/useReaction';
import {
  answerCategories,
  type ReactionContext,
} from '../features/personality/reactions';
import { HostReaction } from '../features/personality/HostReaction';
import { DocumentationReactions } from '../features/personality/DocumentationReactions';
import { questionOrigin, historyForCredential } from '../features/quiz/origins';
import { getDungeonPackage } from '../features/dungeons/packages';
import { cosmeticProgress } from '../features/results/scoring';

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function PlayPage() {
  const { active, lastResult } = useGame();
  const navigate = useNavigate();
  useEffect(() => {
    if (!active && lastResult)
      navigate(`/results/${lastResult.id}`, { replace: true });
  }, [active, lastResult, navigate]);
  if (!active)
    return (
      <>
        <h1>No expedition in progress.</h1>
        <EmptyState title="A new dungeon is waiting.">
          <p>
            In-progress questions aren’t saved across reloads. Completed results
            remain in your local learning trail.
          </p>
          <Link to="/setup" className="button primary">
            Prepare a run <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/tavern" className="text-link">
            View saved results
          </Link>
        </EmptyState>
      </>
    );
  return (
    <PlayingQuestion
      key={`${active.id}-${active.questions[active.currentIndex].id}`}
      active={active}
    />
  );
}

function PlayingQuestion({ active }: { active: ActiveSession }) {
  const {
    taxonomy: selectedTaxonomy,
    history,
    submitAnswer,
    nextQuestion,
    finishSession,
    abandonSession,
  } = useGame();
  const question = active.questions[active.currentIndex];
  const origin = questionOrigin(active, question.id);
  const dungeon = getDungeonPackage(origin.credentialId);
  const taxonomy =
    active.objectiveSnapshots?.[origin.credentialId] ??
    dungeon?.taxonomy ??
    selectedTaxonomy;
  const gauntlet =
    active.config.runMode === 'gauntlet' || active.config.answerMode === 'exam';
  const boss =
    !gauntlet && ['advanced', 'expert'].includes(question.difficulty);
  const response = active.responses.find(
    (item) => item.questionId === question.id,
  );
  const [selected, setSelected] = useState<string[]>(
    response?.selectedAnswer ?? [],
  );
  const { flagged, setFlagged } = useQuestionFlag();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<'finish' | 'abandon' | null>(
    null,
  );
  const legend = useRef<HTMLLegendElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const submitted = Boolean(response);
  const visibility = feedbackVisibility(
    gauntlet ? 'exam' : active.config.answerMode,
    submitted,
  );
  const now = useNow(!submitted || active.config.timerMode === 'session');
  const timerNow =
    response && active.config.timerMode === 'question'
      ? Date.parse(response.submittedAt)
      : Math.max(now, active.questionStartedAt);
  const remaining = remainingSeconds(active, timerNow);
  const elapsed = response
    ? response.timeMs
    : Math.max(0, now - active.questionStartedAt);
  const visibleSelected = response?.selectedAnswer ?? selected;
  const scoringAllowed =
    !gauntlet &&
    (active.config.answerMode === 'immediate' ||
      active.config.answerMode === 'study');
  const canShowSources = visibility.sources;
  const skill = taxonomy.domains
    .flatMap((domain) => domain.skills)
    .find((item) => item.id === question.skill);
  let currentStreak = 0;
  let bestStreak = 0;
  let previousStreak = 0;
  if (scoringAllowed) {
    for (const item of active.responses) {
      const answered = active.questions.find(
        (candidate) => candidate.id === item.questionId,
      );
      if (item.questionId === question.id) previousStreak = currentStreak;
      currentStreak =
        answered && isCorrect(answered, item.selectedAnswer)
          ? currentStreak + 1
          : 0;
      bestStreak = Math.max(bestStreak, currentStreak);
    }
  }
  const domain = taxonomy.domains.find(
    (item) => item.id === question.objectiveDomain,
  );
  const reactionContext: ReactionContext = {
    runMode: gauntlet ? 'gauntlet' : active.config.runMode,
    inProgress: true,
    credentialId: origin.credentialId,
    dungeon: dungeon?.credential.dungeonName,
    floorId: question.objectiveDomain,
    floor: domain?.title,
    boss,
    domainId: question.objectiveDomain,
    domain: domain?.title,
    skill: skill?.title,
    difficulty: question.difficulty,
    streak: currentStreak,
    answerNumber: active.currentIndex + 1,
    timeMs: response?.timeMs,
  };
  const earlier = historyForCredential(history, origin.credentialId)
    .flatMap((result) =>
      result.questions.map((candidate) => ({
        question: candidate,
        response: result.responses.find(
          (item) => item.questionId === candidate.id,
        ),
      })),
    )
    .find(
      (item) =>
        Boolean(item.response?.selectedAnswer.length) &&
        (item.question.id === question.id ||
          (question.conceptId &&
            item.question.conceptId === question.conceptId)),
    );
  const previousResponse = active.responses
    .filter((item) => item.questionId !== question.id)
    .at(-1);
  const previousQuestion = active.questions.find(
    (item) => item.id === previousResponse?.questionId,
  );
  const reaction = useReaction(
    active.id,
    `answer:${question.id}`,
    answerCategories({
      correct: isCorrect(question, visibleSelected),
      selected: visibleSelected,
      correctAnswer: question.correctAnswer,
      timedOut: response?.timedOut ?? false,
      difficulty: question.difficulty,
      boss,
      streak: currentStreak,
      previousStreak,
      previousCorrect: earlier
        ? isCorrect(earlier.question, earlier.response?.selectedAnswer ?? [])
        : undefined,
      recovered: Boolean(
        previousQuestion &&
        previousResponse &&
        !isCorrect(previousQuestion, previousResponse.selectedAnswer),
      ),
    }),
    reactionContext,
    'answer',
    submitted && visibility.answer && !gauntlet,
  );
  const startEvent =
    location.state?.practiceEvent === 'retry'
      ? 'retry'
      : location.state?.practiceEvent === 'weak' ||
          active.config.practiceMode === 'weak'
        ? 'weak-practice'
        : 'start';
  const startReaction = useReaction(
    active.id,
    'session-start',
    [startEvent],
    reactionContext,
    'context',
    active.currentIndex === 0 && !submitted && !gauntlet,
  );
  const bossReaction = useReaction(
    active.id,
    `boss-intro:${question.id}`,
    ['boss-intro'],
    reactionContext,
    'context',
    boss && !submitted,
  );
  const cosmetic = cosmeticProgress([active]);
  const floors = taxonomy.domains.filter((floor) =>
    active.questions.some(
      (item) =>
        questionOrigin(active, item.id).credentialId === origin.credentialId &&
        item.objectiveDomain === floor.id,
    ),
  );
  const currentFloorQuestions = active.questions.filter(
    (item) =>
      questionOrigin(active, item.id).credentialId === origin.credentialId &&
      item.objectiveDomain === question.objectiveDomain,
  );
  const floorComplete =
    submitted &&
    currentFloorQuestions.every((item) =>
      active.responses.some((answer) => answer.questionId === item.id),
    );
  const floorReaction = useReaction(
    active.id,
    `floor-cleared:${origin.credentialId}:${question.objectiveDomain}`,
    ['floor-cleared'],
    reactionContext,
    'context',
    floorComplete && !gauntlet && scoringAllowed,
  );
  useEffect(() => {
    legend.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (submitted) feedback.current?.focus({ preventScroll: true });
  }, [submitted]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selected.length && !submitted) submitAnswer(selected, flagged);
  };
  const select = (id: string) => {
    if (submitted) return;
    setSelected(
      question.questionType === 'multi-select'
        ? selected.includes(id)
          ? selected.filter((item) => item !== id)
          : [...selected, id]
        : [id],
    );
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.key !== 'Enter' ||
        document.querySelector('dialog[open]')
      )
        return;
      event.preventDefault();
      if (submitted) nextQuestion();
      else if (selected.length) submitAnswer(selected, flagged);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [submitted, selected, flagged, nextQuestion, submitAnswer]);
  return (
    <div className="play-page">
      <header className="play-header">
        <div>
          <Link className="text-link muted" to="/setup">
            Expedition settings
          </Link>
          <h1>
            {gauntlet
              ? 'Practice in progress.'
              : active.config.runMode === 'raid'
                ? 'The Grand Raid.'
                : 'Into the dungeon.'}
          </h1>
        </div>
        <div className="play-mode">
          <span className="count-badge">
            {labels[active.config.answerMode]}
          </span>
          {active.config.timerMode !== 'off' && (
            <div
              className={`timer ${remaining !== null && remaining <= 10 ? 'timer-urgent' : ''}`}
              role="timer"
              aria-label={`${active.config.timerMode === 'session' ? 'Session' : 'Question'} timer: ${remaining ?? 0} seconds remaining`}
            >
              <Clock3 size={17} aria-hidden="true" />
              <strong>{clock(remaining ?? 0)}</strong>
              <span>
                {active.config.timerMode === 'session'
                  ? 'session left'
                  : submitted
                    ? 'at submission'
                    : 'question left'}
              </span>
            </div>
          )}
        </div>
      </header>
      <div className="question-progress">
        <div>
          <span>
            Question <strong>{active.currentIndex + 1}</strong> of{' '}
            <strong>{active.questions.length}</strong>
          </span>
          <span>{active.responses.length} submitted</span>
        </div>
        {active.currentIndex === 0 && !submitted && (
          <HostReaction reaction={startReaction} />
        )}
        <progress
          max={active.questions.length}
          value={active.responses.length}
          aria-label={`${active.responses.length} of ${active.questions.length} questions submitted`}
        />
      </div>
      <details className="floor-strip">
        <summary>
          {gauntlet ? 'Objective progress' : 'Your floor map'} · {floors.length}{' '}
          sampled floors · {dungeon?.credential.examCode ?? origin.credentialId}
        </summary>
        <ol>
          {floors.map((floor) => {
            const encounters = active.questions.filter(
              (item) =>
                questionOrigin(active, item.id).credentialId ===
                  origin.credentialId && item.objectiveDomain === floor.id,
            );
            const done = encounters.filter((item) =>
              active.responses.some((answer) => answer.questionId === item.id),
            ).length;
            return (
              <li
                key={floor.id}
                aria-current={
                  floor.id === question.objectiveDomain ? 'step' : undefined
                }
              >
                {floor.title}
                <span>
                  {done}/{encounters.length} submitted
                  {done === encounters.length
                    ? ' · Complete'
                    : floor.id === question.objectiveDomain
                      ? ' · Current floor'
                      : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </details>
      {boss && (
        <aside className="boss-banner" aria-label="Boss encounter framing">
          <Swords size={30} aria-hidden="true" />
          <div>
            <h2>Boss encounter · {labels[question.difficulty]}</h2>
            <p>
              {dungeon?.credential.themeMetadata.bossName ??
                'The chamber guardian'}{' '}
              awaits. This banner is flavor only; the technical scenario below
              is unchanged.
            </p>
            <HostReaction reaction={bossReaction} />
          </div>
        </aside>
      )}
      <div className="play-layout">
        <div className="question-column">
          <section className="panel question-panel">
            <QuestionMetadata question={question} />
            {visibility.coaching && !submitted && (
              <aside className="study-coaching">
                <Lightbulb size={21} aria-hidden="true" />
                <div>
                  <strong>DM whisper · study coaching</strong>
                  <p>
                    Focus on “{question.subskill}” within{' '}
                    {skill?.title ?? question.skill}. Identify the requirements
                    and constraints before comparing the choices. Use the
                    documentation if you need a refresher.
                  </p>
                </div>
              </aside>
            )}
            <form onSubmit={submit}>
              <fieldset className="answer-fieldset">
                <legend ref={legend} tabIndex={-1} className="question-title">
                  {question.question}
                </legend>
                <CodeSnippet question={question} />
                <p className="selection-help" id={`answer-help-${question.id}`}>
                  {question.questionType === 'multi-select'
                    ? `Choose ${question.correctAnswer.length} answers. Exact match required; no partial credit.`
                    : 'Select one answer.'}
                </p>
                <div className="answer-options">
                  {question.answerChoices.map((choice, index) => {
                    const chosen = visibleSelected.includes(choice.id);
                    const right =
                      visibility.answer &&
                      question.correctAnswer.includes(choice.id);
                    const wrong = visibility.answer && chosen && !right;
                    return (
                      <label
                        key={choice.id}
                        className={`answer-option ${chosen ? 'chosen' : ''} ${right ? 'right-answer' : ''} ${wrong ? 'wrong-answer' : ''} ${submitted ? 'locked' : ''}`}
                      >
                        <input
                          name={`answer-${question.id}`}
                          type={
                            question.questionType === 'multi-select'
                              ? 'checkbox'
                              : 'radio'
                          }
                          checked={chosen}
                          disabled={submitted}
                          onChange={() => select(choice.id)}
                          aria-describedby={`answer-help-${question.id}`}
                        />
                        <span className="choice-letter" aria-hidden="true">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="choice-text">
                          {choice.text}
                          {visibility.answer && (
                            <span className="choice-status">
                              {right
                                ? 'Correct answer'
                                : chosen
                                  ? 'Your answer · incorrect'
                                  : ''}
                              {right && chosen ? ' · Your answer' : ''}
                            </span>
                          )}
                        </span>
                        {right && <Check size={19} aria-hidden="true" />}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="question-toolbar">
                <label className="flag-control">
                  <input
                    type="checkbox"
                    checked={response?.flagged ?? flagged}
                    disabled={submitted}
                    onChange={(event) => setFlagged(event.target.checked)}
                  />
                  <Flag size={17} aria-hidden="true" /> Flag for review
                </label>
                <span className="response-time">
                  <Clock3 size={15} aria-hidden="true" />
                  {(elapsed / 1000).toFixed(1)}s{' '}
                  {submitted ? 'response time' : 'on this question'}
                </span>
              </div>
              {!submitted && (
                <div className="answer-actions">
                  <button
                    type="button"
                    className="button quiet"
                    onClick={() => submitAnswer([], flagged)}
                  >
                    <SkipForward size={17} aria-hidden="true" /> Skip question
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={!selected.length}
                    aria-keyshortcuts="Alt+Enter"
                  >
                    Submit answer <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
            </form>
          </section>
          {submitted && (
            <div
              ref={feedback}
              tabIndex={-1}
              className="feedback-wrap"
              aria-describedby={`feedback-status-${question.id}`}
            >
              <p
                className="submission-status"
                role="status"
                aria-label="Answer feedback"
                id={`feedback-status-${question.id}`}
              >
                {response?.timedOut
                  ? 'Time’s up. This question was recorded as unanswered.'
                  : !response?.selectedAnswer.length
                    ? 'Question skipped.'
                    : visibility.answer
                      ? isCorrect(question, visibleSelected)
                        ? 'Correct.'
                        : 'Incorrect.'
                      : 'Answer recorded.'}
                {!visibility.answer &&
                  ' Correctness and answers will be revealed at completion.'}
                {visibility.explanation && (
                  <span className="sr-only">
                    {' '}
                    Explanation: {question.explanation}
                  </span>
                )}
              </p>
              {visibility.explanation && (
                <QuestionExplanation
                  question={question}
                  selected={visibleSelected}
                  revealAnswer={visibility.answer}
                  reaction={reaction}
                />
              )}
              <div className="next-action">
                <button
                  className="button primary"
                  onClick={nextQuestion}
                  aria-keyshortcuts="Alt+Enter"
                >
                  {active.currentIndex === active.questions.length - 1
                    ? 'View results'
                    : 'Next question'}
                  <ArrowRight size={19} aria-hidden="true" />
                </button>
              </div>
              {floorComplete && scoringAllowed && !gauntlet && (
                <div className="loot-moment">
                  <p>
                    Floor complete · {currentFloorQuestions.length} encounters
                    submitted. Completion is not mastery.
                  </p>
                  <HostReaction reaction={floorReaction} />
                </div>
              )}
            </div>
          )}
        </div>
        <aside className="play-aside">
          <section className="session-note">
            <h2>{gauntlet ? 'Your practice session' : 'Your expedition'}</h2>
            <dl className="summary-list">
              <div>
                <dt>Question order</dt>
                <dd>{labels[active.config.order]}</dd>
              </div>
              <div>
                <dt>Difficulty setting</dt>
                <dd>{labels[active.config.difficulty]}</dd>
              </div>
            </dl>
            {scoringAllowed && (
              <div className="streak-display">
                <Flame size={21} aria-hidden="true" />
                <div>
                  <strong>{currentStreak} current streak</strong>
                  <span>Best this session: {bestStreak}</span>
                </div>
              </div>
            )}
            {scoringAllowed && !gauntlet && (
              <div
                className="cosmetic-hud"
                aria-label="Cosmetic adventure statistics"
              >
                <div className="hud-values">
                  <span>
                    <Heart size={16} aria-hidden="true" /> {cosmetic.hp}/
                    {cosmetic.maxHp} HP
                  </span>
                  <span>
                    <Gem size={16} aria-hidden="true" /> {cosmetic.xp} XP
                  </span>
                  <span>
                    <Swords size={16} aria-hidden="true" />{' '}
                    {cosmetic.damageDealt} damage dealt
                  </span>
                </div>
                <small>
                  Cosmetic only. HP reaching zero never ends a run or changes
                  scores, answers, or time.
                </small>
                {cosmetic.loot > 0 && (
                  <p className="loot-moment">
                    {cosmetic.loot} loot token{cosmetic.loot === 1 ? '' : 's'}{' '}
                    found · one per five correct answers
                  </p>
                )}
              </div>
            )}
            <p>
              {scoringAllowed
                ? 'Every correct answer counts equally. No speed bonuses; take time to understand the why.'
                : 'No running score, correctness indicators, or answer highlights. Your complete review unlocks at the end.'}
            </p>
          </section>
          {canShowSources ? (
            <section className="session-note source-note">
              <BookOpen size={22} aria-hidden="true" />
              <h2>Open the tome.</h2>
              <p>
                Check the objective alignment and documentation supporting this
                question.
              </p>
              <button
                className="button secondary"
                onClick={() => setSourcesOpen(true)}
              >
                Open tome · view sources{' '}
                <BookOpen size={17} aria-hidden="true" />
              </button>
              {visibility.answer && (
                <DocumentationReactions
                  scope={active.id}
                  context={reactionContext}
                >
                  <ul className="compact-source-links">
                    {question.sourceUrls.map((url, index) => (
                      <li key={url}>
                        <LearnLink href={url}>
                          {question.documentationTitles[index]}
                        </LearnLink>
                      </li>
                    ))}
                  </ul>
                </DocumentationReactions>
              )}
            </section>
          ) : (
            <section className="session-note">
              <BookOpen size={22} aria-hidden="true" />
              <h2>Stay in the challenge.</h2>
              <p>
                {active.config.answerMode === 'immediate'
                  ? 'Submit your answer to unlock sources and full explanations for this question.'
                  : active.config.answerMode === 'explanations-only'
                    ? 'Concept explanations unlock after submission. Correctness, answers, distractor analysis, and sources wait until completion.'
                    : 'Sources and full explanations unlock when your session is complete.'}
              </p>
            </section>
          )}
          <div className="session-controls">
            <button
              className="text-button"
              onClick={() => setConfirmation('finish')}
            >
              Finish early
            </button>
            <button
              className="text-button muted"
              onClick={() => setConfirmation('abandon')}
            >
              <LogOut size={15} aria-hidden="true" /> Discard challenge
            </button>
          </div>
          <p className="small muted">
            Leaving this page keeps the session in memory. Reloading or closing
            the app resets it.
          </p>
          <p className="small muted">
            Keyboard: use Tab and arrow keys for choices. Alt + Enter submits
            your selection or continues after feedback. Shortcuts pause while a
            dialog is open.
          </p>
        </aside>
      </div>
      {sourcesOpen && canShowSources && (
        <QuestionSources
          question={question}
          groundedAt={origin.groundedAt ?? null}
          credentialId={origin.credentialId}
          onClose={() => setSourcesOpen(false)}
        />
      )}
      {confirmation === 'finish' && (
        <ConfirmDialog
          title="Finish this challenge early?"
          confirmLabel="Finish & score session"
          onClose={() => setConfirmation(null)}
          onConfirm={() => finishSession(flagged)}
        >
          <p>
            {active.questions.length - active.responses.length} unsubmitted
            question
            {active.questions.length - active.responses.length === 1
              ? ''
              : 's'}{' '}
            will count as unanswered, including any current selection you
            haven’t submitted. The completed result will be saved locally.
          </p>
        </ConfirmDialog>
      )}
      {confirmation === 'abandon' && (
        <ConfirmDialog
          title="Discard this challenge?"
          confirmLabel="Discard challenge"
          onClose={() => setConfirmation(null)}
          onConfirm={() => {
            abandonSession();
            navigate('/setup');
          }}
          destructive
        >
          <p>
            Your in-progress answers will be discarded. Nothing from this
            challenge will be scored or added to history. Previous completed
            results stay saved.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
