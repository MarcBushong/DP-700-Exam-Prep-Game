import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Info,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { useGame } from '../features/quiz/context';
import {
  answerModes,
  complexities,
  difficulties,
  formats,
  orders,
} from '../features/grounding/schema';
import { defaultConfig, labels, type QuizConfig } from '../features/quiz/types';
import { selectQuestions } from '../features/quiz/engine';
import { ConfirmDialog, PageHeading } from '../components/common';

const modeDescriptions: Record<QuizConfig['answerMode'], string> = {
  immediate:
    'See correctness, the right answer, full explanations, and supporting sources after each submission.',
  'explanations-only':
    'Learn the relevant concept through concise and deeper explanations after submitting. No correctness, answer highlights, or distractor analysis until completion.',
  hidden:
    'Keep your focus. All answers, correctness, explanations, and sources wait until the session is complete.',
  study:
    'Get objective-based coaching and documentation before answering, then full feedback after submission.',
  exam: 'No coaching, sources, correctness, or explanations until completion. Choose a timer below if you want one. This is practice, not an actual exam simulation.',
};

const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

export function SetupPage() {
  const {
    bank,
    taxonomy,
    config,
    setConfig,
    history,
    active,
    startSession,
    recentQuestionIds,
  } = useGame();
  const [customCount, setCustomCount] = useState(
    ![5, 10, 20, 30, 50].includes(config.questionCount),
  );
  const [countInput, setCountInput] = useState(String(config.questionCount));
  const [timerInput, setTimerInput] = useState(String(config.timerSeconds));
  const [replace, setReplace] = useState(false);
  const navigate = useNavigate();
  const selection = useMemo(
    () =>
      selectQuestions(
        bank,
        taxonomy,
        config,
        history,
        Math.random,
        recentQuestionIds,
      ),
    [bank, taxonomy, config, history, recentQuestionIds],
  );
  const update = <K extends keyof QuizConfig>(key: K, value: QuizConfig[K]) =>
    setConfig({ ...config, [key]: value });
  const domains = taxonomy.domains.filter(
    (domain) =>
      !config.objectiveDomains.length ||
      config.objectiveDomains.includes(domain.id),
  );
  const availableSkills = domains.flatMap((domain) => domain.skills);
  const availableSubskills = availableSkills.filter(
    (skill) => !config.skills.length || config.skills.includes(skill.id),
  );
  const countValid =
    !customCount ||
    (/^\d+$/.test(countInput) &&
      Number(countInput) >= 1 &&
      Number(countInput) <= 50);
  const timerValid =
    config.timerMode === 'off' ||
    (/^\d+$/.test(timerInput) &&
      Number(timerInput) >= 10 &&
      Number(timerInput) <= 7200);
  const canStart = selection.eligibleCount > 0 && countValid && timerValid;
  const begin = () => {
    if (canStart && startSession(config))
      navigate('/play', {
        state: {
          practiceEvent: config.practiceMode === 'weak' ? 'weak' : 'start',
        },
      });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (active) setReplace(true);
    else begin();
  };
  const changeDomains = (next: string[]) => {
    const skills = taxonomy.domains
      .filter((domain) => !next.length || next.includes(domain.id))
      .flatMap((domain) => domain.skills);
    const keptSkills = config.skills.filter((id) =>
      skills.some((skill) => skill.id === id),
    );
    const subskills = skills
      .filter((skill) => !keptSkills.length || keptSkills.includes(skill.id))
      .flatMap((skill) => skill.subskills);
    setConfig({
      ...config,
      objectiveDomains: next,
      skills: keptSkills,
      subskills: config.subskills.filter((subskill) =>
        subskills.includes(subskill),
      ),
    });
  };
  const changeSkills = (next: string[]) => {
    const subskills = availableSkills
      .filter((skill) => !next.length || next.includes(skill.id))
      .flatMap((skill) => skill.subskills);
    setConfig({
      ...config,
      skills: next,
      subskills: config.subskills.filter((subskill) =>
        subskills.includes(subskill),
      ),
    });
  };
  return (
    <>
      <PageHeading
        title="Make this challenge yours."
        description="A quick confidence boost or a deeper dive? You set the pace."
      >
        <button
          className="button secondary small-button"
          onClick={() => {
            setConfig({ ...defaultConfig });
            setCustomCount(false);
            setCountInput(String(defaultConfig.questionCount));
            setTimerInput(String(defaultConfig.timerSeconds));
          }}
        >
          <RotateCcw size={16} aria-hidden="true" /> Reset filters
        </button>
      </PageHeading>
      <form className="setup-layout" onSubmit={submit}>
        <div className="setup-sections">
          <section
            className="panel setup-section"
            aria-labelledby="challenge-shape"
          >
            <div className="section-title">
              <SlidersHorizontal size={21} aria-hidden="true" />
              <h2 id="challenge-shape">Shape your challenge</h2>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="difficulty">Difficulty</label>
                <select
                  id="difficulty"
                  value={config.difficulty}
                  onChange={(event) => {
                    const value = [...difficulties, 'adaptive' as const].find(
                      (item) => item === event.target.value,
                    );
                    if (value) update('difficulty', value);
                  }}
                  aria-describedby="adaptive-help"
                >
                  {[...difficulties, 'adaptive'].map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="complexity">Complexity</label>
                <select
                  id="complexity"
                  value={config.complexity}
                  onChange={(event) => {
                    const value = [...complexities, 'mixed' as const].find(
                      (item) => item === event.target.value,
                    );
                    if (value) update('complexity', value);
                  }}
                >
                  {['mixed', ...complexities].map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="field-help" id="adaptive-help">
              Adaptive starts near Intermediate unless saved performance
              provides enough evidence. Three consecutive correct or incorrect
              answers at the same difficulty move the target one level up or
              down. It selects the closest remaining difficulty within the next
              domain; it doesn’t generate questions or guarantee difficulty
              coverage.
            </p>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="format">Question format</label>
                <select
                  id="format"
                  value={config.format}
                  onChange={(event) => {
                    const value = [...formats, 'mixed' as const].find(
                      (item) => item === event.target.value,
                    );
                    if (value) update('format', value);
                  }}
                >
                  {['mixed', ...formats].map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="practice">Practice focus</label>
                <select
                  id="practice"
                  value={config.practiceMode}
                  onChange={(event) =>
                    update(
                      'practiceMode',
                      event.target.value === 'weak' ? 'weak' : 'all',
                    )
                  }
                >
                  <option value="all">All matching topics</option>
                  <option value="weak">Previously missed topics</option>
                </select>
              </div>
            </div>
            <fieldset className="count-field">
              <legend>Number of questions</legend>
              <div className="segmented">
                {[5, 10, 20, 30, 50].map((count) => (
                  <label
                    key={count}
                    className={`segment ${!customCount && config.questionCount === count ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="count"
                      checked={!customCount && config.questionCount === count}
                      onChange={() => {
                        setCustomCount(false);
                        setCountInput(String(count));
                        update('questionCount', count);
                      }}
                    />
                    <span>{count}</span>
                  </label>
                ))}
                <label className={`segment ${customCount ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="count"
                    checked={customCount}
                    onChange={() => setCustomCount(true)}
                  />
                  <span>Custom</span>
                </label>
              </div>
              {customCount && (
                <div className="field custom-count">
                  <label htmlFor="custom-count">
                    Custom question count (1–50)
                  </label>
                  <input
                    id="custom-count"
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={countInput}
                    aria-invalid={!countValid}
                    aria-describedby={!countValid ? 'count-error' : undefined}
                    onChange={(event) => {
                      setCountInput(event.target.value);
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value >= 1 && value <= 50)
                        update('questionCount', value);
                    }}
                  />
                  {!countValid && (
                    <p id="count-error" className="error-text">
                      Enter a whole number from 1 to 50.
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          </section>
          <section
            className="panel setup-section"
            aria-labelledby="topic-heading"
          >
            <h2 id="topic-heading">Choose your territory</h2>
            <p className="field-help">
              No selections means all. Combine domains, skills, and subskills to
              focus your practice.
            </p>
            <fieldset className="topic-field">
              <legend>Objective domains</legend>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={config.objectiveDomains.length === 0}
                  onChange={() => changeDomains([])}
                />{' '}
                All objective domains
              </label>
              {taxonomy.domains.map((domain) => (
                <label key={domain.id} className="topic-option">
                  <input
                    type="checkbox"
                    checked={config.objectiveDomains.includes(domain.id)}
                    onChange={() =>
                      changeDomains(toggle(config.objectiveDomains, domain.id))
                    }
                  />
                  <span>
                    {domain.title}
                    <small>
                      {domain.weightRange.join('–')}% guide weight ·{' '}
                      {
                        bank.filter(
                          (question) => question.objectiveDomain === domain.id,
                        ).length
                      }{' '}
                      questions
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            <details className="filter-details">
              <summary>
                Specific skills{' '}
                <span>
                  {config.skills.length
                    ? `${config.skills.length} selected`
                    : 'All'}
                </span>
              </summary>
              <fieldset>
                <legend className="sr-only">Skills</legend>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={config.skills.length === 0}
                    onChange={() => changeSkills([])}
                  />{' '}
                  All available skills
                </label>
                {availableSkills.map((skill) => (
                  <label className="check-label" key={skill.id}>
                    <input
                      type="checkbox"
                      checked={config.skills.includes(skill.id)}
                      onChange={() =>
                        changeSkills(toggle(config.skills, skill.id))
                      }
                    />
                    {skill.title}
                  </label>
                ))}
              </fieldset>
            </details>
            <details className="filter-details">
              <summary>
                Specific subskills{' '}
                <span>
                  {config.subskills.length
                    ? `${config.subskills.length} selected`
                    : 'All'}
                </span>
              </summary>
              <fieldset>
                <legend className="sr-only">Subskills</legend>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={config.subskills.length === 0}
                    onChange={() => update('subskills', [])}
                  />{' '}
                  All available subskills
                </label>
                {availableSubskills.map((skill) => (
                  <div className="subskill-group" key={skill.id}>
                    <h3>{skill.title}</h3>
                    {skill.subskills.map((subskill) => (
                      <label className="check-label" key={subskill}>
                        <input
                          type="checkbox"
                          checked={config.subskills.includes(subskill)}
                          onChange={() =>
                            update(
                              'subskills',
                              toggle(config.subskills, subskill),
                            )
                          }
                        />
                        {subskill}
                      </label>
                    ))}
                  </div>
                ))}
              </fieldset>
            </details>
          </section>
          <section
            className="panel setup-section"
            aria-labelledby="experience-heading"
          >
            <h2 id="experience-heading">Find your learning rhythm</h2>
            <fieldset className="answer-mode-field">
              <legend>Answer reveal mode</legend>
              <div className="mode-options">
                {answerModes.map((mode) => (
                  <label
                    key={mode}
                    className={`mode-option ${config.answerMode === mode ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="answer-mode"
                      value={mode}
                      checked={config.answerMode === mode}
                      onChange={() => update('answerMode', mode)}
                    />
                    <span>
                      <strong>{labels[mode]}</strong>
                      <small>{modeDescriptions[mode]}</small>
                    </span>
                    {config.answerMode === mode && (
                      <Check size={18} aria-hidden="true" />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="timer">Timer</label>
                <select
                  id="timer"
                  value={config.timerMode}
                  onChange={(event) => {
                    const value = ['off', 'question', 'session'] as const;
                    const mode = value.find(
                      (item) => item === event.target.value,
                    );
                    if (mode) update('timerMode', mode);
                  }}
                >
                  <option value="off">Off · take your time</option>
                  <option value="question">Per question</option>
                  <option value="session">Whole session</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="order">Question order</label>
                <select
                  id="order"
                  value={config.order}
                  onChange={(event) => {
                    const value = orders.find(
                      (item) => item === event.target.value,
                    );
                    if (value) update('order', value);
                  }}
                >
                  {orders.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {config.timerMode !== 'off' && (
              <div className="field timer-field">
                <label htmlFor="timer-seconds">
                  {config.timerMode === 'question'
                    ? 'Seconds per question'
                    : 'Seconds for the entire session'}{' '}
                  (10–7200)
                </label>
                <input
                  id="timer-seconds"
                  type="number"
                  min={10}
                  max={7200}
                  step={1}
                  value={timerInput}
                  aria-invalid={!timerValid}
                  aria-describedby="timer-help"
                  onChange={(event) => {
                    setTimerInput(event.target.value);
                    const value = Number(event.target.value);
                    if (Number.isInteger(value) && value >= 10 && value <= 7200)
                      update('timerSeconds', value);
                  }}
                />
                <p
                  className={timerValid ? 'field-help' : 'error-text'}
                  id="timer-help"
                >
                  {!timerValid
                    ? 'Enter a whole number from 10 to 7200.'
                    : config.timerMode === 'question'
                      ? 'At zero, the current question locks as unanswered. Continue when you’re ready.'
                      : 'The clock keeps running during feedback and on other pages. At zero, the session ends and unvisited questions count as unanswered.'}
                </p>
              </div>
            )}
            <p className="field-help">
              Balanced ordering aims for the guide’s domain weights within this
              small bank. Weakest-first uses completed local history. Neither is
              an exam simulation.
            </p>
          </section>
        </div>
        <aside className="setup-summary panel">
          <div className="summary-symbol">
            <LayersSymbol />
          </div>
          <h2>Ready when you are.</h2>
          <p className="matching-count">
            <strong>{selection.eligibleCount}</strong> matching questions
          </p>
          <dl className="summary-list">
            <div>
              <dt>This session</dt>
              <dd>
                {Math.min(config.questionCount, selection.eligibleCount)} unique
                questions
              </dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>{labels[config.difficulty]}</dd>
            </div>
            <div>
              <dt>Feedback</dt>
              <dd>{labels[config.answerMode]}</dd>
            </div>
            <div>
              <dt>Timer</dt>
              <dd>
                {config.timerMode === 'off'
                  ? 'No timer'
                  : `${config.timerSeconds}s / ${config.timerMode}`}
              </dd>
            </div>
          </dl>
          <div aria-live="polite">
            {selection.warnings.map((warning) => (
              <p className="notice warning" key={warning}>
                {warning}
              </p>
            ))}
            {(!countValid || !timerValid) && (
              <p className="error-text">
                Check the numeric fields before starting.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!canStart}
            className="button primary start-button"
          >
            {active ? 'Replace & begin' : 'Begin challenge'}
            <ArrowRight size={19} aria-hidden="true" />
          </button>
          {active && (
            <p className="small">
              <strong>Starting replaces your in-progress quiz.</strong> It will
              not be saved as a result.{' '}
              <Link to="/play">Continue it instead.</Link>
            </p>
          )}
          <p className="summary-note">
            <Info size={16} aria-hidden="true" />
            <span>
              Settings are saved locally. Reloading the page resets an
              in-progress quiz; completed sessions stay saved.
            </span>
          </p>
        </aside>
      </form>
      {replace && (
        <ConfirmDialog
          title="Replace your current challenge?"
          confirmLabel="Replace & begin"
          onClose={() => setReplace(false)}
          onConfirm={begin}
          destructive
        >
          <p>
            Your unfinished challenge will be discarded, not scored or added to
            history. Begin a new{' '}
            {Math.min(config.questionCount, selection.eligibleCount)}-question
            challenge?
          </p>
          <p>
            <Link to="/play">Continue your current challenge instead.</Link>
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

function LayersSymbol() {
  return <SlidersHorizontal size={26} strokeWidth={1.7} aria-hidden="true" />;
}
