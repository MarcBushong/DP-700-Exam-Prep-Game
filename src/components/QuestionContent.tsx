import { BookOpen, CheckCircle2, Flag, Lightbulb, XCircle } from 'lucide-react';
import { useGame } from '../features/quiz/context';
import { labels } from '../features/quiz/types';
import { isCorrect } from '../features/quiz/engine';
import type { Question } from '../features/grounding/schema';
import { DateStamp, LearnLink, Modal } from './common';

const correctReactions = [
  'Correct. The pipeline has declined to fail dramatically.',
  'A clean result. Somewhere, a Delta table just relaxed.',
  'That Spark session can keep its day job.',
];
const missedReactions = [
  'Plot twist: the documentation has a different plan.',
  'That answer needs one more transformation.',
  'A tiny detour. No production data was harmed.',
];

export function QuestionMetadata({ question }: { question: Question }) {
  const { taxonomy } = useGame();
  const domain = taxonomy.domains.find(
    (item) => item.id === question.objectiveDomain,
  );
  const skill = domain?.skills.find((item) => item.id === question.skill);
  return (
    <div className="question-metadata">
      <p className="question-domain">
        {domain?.title ?? question.objectiveDomain}
      </p>
      <p className="question-objective">
        <strong>{skill?.title ?? question.skill}</strong>
        <span>{question.subskill}</span>
      </p>
      <ul className="tags" aria-label="Question metadata">
        <li>{labels[question.difficulty]}</li>
        <li>{labels[question.complexity]}</li>
        <li>{labels[question.questionType]}</li>
        {question.featureStatus === 'Preview' && (
          <li className="preview-tag">Preview feature</li>
        )}
        {question.tags.map((tag) => (
          <li className="topic-tag" key={tag}>
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CodeSnippet({ question }: { question: Question }) {
  if (!question.codeSnippet) return null;
  return (
    <div className="code-block">
      <span className="code-language">{question.codeLanguage}</span>
      <pre tabIndex={0} aria-label={`${question.codeLanguage} code snippet`}>
        <code>{question.codeSnippet}</code>
      </pre>
    </div>
  );
}

export function QuestionExplanation({
  question,
  selected,
  revealAnswer,
  banter = false,
}: {
  question: Question;
  selected: string[];
  revealAnswer: boolean;
  banter?: boolean;
}) {
  const correct = isCorrect(question, selected);
  const reactionIndex =
    [...question.id].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    ) % correctReactions.length;
  return (
    <section
      className={`question-feedback ${revealAnswer ? (correct ? 'feedback-correct' : 'feedback-missed') : ''}`}
      aria-label={revealAnswer ? 'Answer feedback' : 'Concept explanation'}
    >
      {revealAnswer ? (
        <>
          <div className="feedback-title">
            {correct ? (
              <CheckCircle2 size={24} aria-hidden="true" />
            ) : (
              <Lightbulb size={24} aria-hidden="true" />
            )}
            <h2>
              {correct
                ? banter
                  ? 'Correct. Nicely done!'
                  : 'Correct.'
                : !selected.length
                  ? banter
                    ? 'Unanswered. Let’s unpack it.'
                    : 'Unanswered.'
                  : banter
                    ? 'Not quite. Here’s the why.'
                    : 'Incorrect.'}
            </h2>
          </div>
          {banter && (
            <p className="banter">
              {(correct ? correctReactions : missedReactions)[reactionIndex]}
            </p>
          )}
          <p>
            <strong>
              Correct answer{question.correctAnswer.length > 1 ? 's' : ''}:
            </strong>{' '}
            {question.answerChoices
              .filter((choice) => question.correctAnswer.includes(choice.id))
              .map((choice) => choice.text)
              .join(' · ')}
          </p>
        </>
      ) : (
        <div className="feedback-title">
          <BookOpen size={23} aria-hidden="true" />
          <h2>The concept, explained</h2>
        </div>
      )}
      <p>{question.explanation}</p>
      <details className="deep-explanation">
        <summary>Go a level deeper</summary>
        <p>{question.deepExplanation}</p>
      </details>
      {revealAnswer && (
        <details className="distractor-explanations">
          <summary>Why the other choices don’t fit</summary>
          <dl>
            {question.answerChoices
              .filter((choice) => !question.correctAnswer.includes(choice.id))
              .map((choice) => (
                <div key={choice.id}>
                  <dt>
                    <XCircle size={16} aria-hidden="true" />
                    {choice.text}
                  </dt>
                  <dd>{question.whyOtherAnswersAreWrong[choice.id]}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
    </section>
  );
}

export function QuestionSources({
  question,
  groundedAt,
  onClose,
}: {
  question: Question;
  groundedAt?: string;
  onClose: () => void;
}) {
  const { manifest, taxonomy } = useGame();
  const isCurrent = !groundedAt || groundedAt === manifest.lastGroundedAt;
  const domain = taxonomy.domains.find(
    (item) => item.id === question.objectiveDomain,
  );
  const skill = domain?.skills.find((item) => item.id === question.skill);
  return (
    <Modal
      title="The sources behind this question"
      onClose={onClose}
      className="sources-modal"
    >
      <p className="muted">
        Direct public Microsoft Learn documentation. Links open in a new tab
        only when you choose them.
      </p>
      <div className="source-alignment">
        <strong>Objective alignment</strong>
        <p>
          {domain?.title ?? question.objectiveDomain}
          <br />
          {skill?.title ?? question.skill}
          <br />
          {question.subskill}
        </p>
      </div>
      {!isCurrent && (
        <p className="notice">
          Historical question snapshot, grounded{' '}
          <DateStamp value={groundedAt ?? question.lastValidatedAt} precise />.
          Current source-manifest summaries may differ, so this view uses the
          titles and URLs saved with your question. Retrieval and source review
          dates were not stored in that snapshot.
        </p>
      )}
      <ol className="source-list">
        {question.sourceUrls.map((url, index) => {
          const source = isCurrent
            ? manifest.sources.find(
                (item) =>
                  item.sourceId === question.sourceIds[index] &&
                  item.url === url &&
                  item.title === question.documentationTitles[index],
              )
            : undefined;
          return (
            <li key={`${question.sourceIds[index]}-${url}`}>
              <h3>
                <LearnLink href={url}>
                  {question.documentationTitles[index]}
                </LearnLink>
              </h3>
              <p className="source-url">{url}</p>
              {source ? (
                <>
                  <p>{source.shortSummary}</p>
                  <dl className="source-dates">
                    <div>
                      <dt>Retrieved</dt>
                      <dd>
                        <DateStamp value={source.retrievedAt} precise />
                      </dd>
                    </div>
                    <div>
                      <dt>Source reviewed</dt>
                      <dd>
                        <DateStamp value={source.lastReviewedAt} precise />
                      </dd>
                    </div>
                    <div>
                      <dt>Feature status</dt>
                      <dd>{source.featureStatus}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="small muted">
                  Saved question citation. A matching source summary and source
                  review metadata are unavailable; no summary has been inferred.
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="small muted">
        Question feature status: {question.featureStatus}. Question generated{' '}
        <DateStamp value={question.generatedAt} precise />; last validated{' '}
        <DateStamp value={question.lastValidatedAt} precise />. Documentation
        and preview behavior can change.
      </p>
    </Modal>
  );
}

export function FlagLabel({ flagged }: { flagged: boolean }) {
  return flagged ? (
    <span className="flag-badge">
      <Flag size={14} aria-hidden="true" /> Flagged for review
    </span>
  ) : null;
}
