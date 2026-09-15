import { BookOpen, CheckCircle2, Flag, Lightbulb, XCircle } from 'lucide-react';
import { useGame } from '../features/quiz/context';
import { labels } from '../features/quiz/types';
import { isCorrect } from '../features/quiz/engine';
import type { Question, Taxonomy } from '../features/grounding/schema';
import { questionOrigin } from '../features/quiz/origins';
import { getDungeonPackage } from '../features/dungeons/packages';
import { credentials } from '../features/dungeons/catalog';
import { DateStamp, LearnLink, Modal } from './common';
import { HostReaction } from '../features/personality/HostReaction';
import { useReaction } from '../features/personality/useReaction';
import type { Reaction } from '../features/personality/reactions';

const authoringTags = new Set([
  'original-grounded-candidate',
  'original-pass1',
  'pass-1-candidate',
  'pass1-candidate',
  'pass1-only',
]);

export function QuestionMetadata({
  question,
  taxonomySnapshot,
  credentialId,
  objectiveVersion,
}: {
  question: Question;
  taxonomySnapshot?: Taxonomy | null;
  credentialId?: string;
  objectiveVersion?: string;
}) {
  const game = useGame();
  const neutral =
    game.active?.config.runMode === 'gauntlet' ||
    game.active?.config.answerMode === 'exam';
  const origin = game.active
    ? questionOrigin(game.active, question.id)
    : undefined;
  const id = credentialId ?? origin?.credentialId ?? game.selectedCredentialId;
  const taxonomy =
    taxonomySnapshot !== undefined
      ? taxonomySnapshot
      : (game.active?.objectiveSnapshots?.[id] ??
        getDungeonPackage(id)?.taxonomy ??
        game.taxonomy);
  const credential = credentials.find((item) => item.credentialId === id);
  const domain = taxonomy?.domains.find(
    (item) => item.id === question.objectiveDomain,
  );
  const skill = domain?.skills.find((item) => item.id === question.skill);
  return (
    <div className="question-metadata">
      <div className="dungeon-origin" data-dungeon-id={id}>
        <span>
          {credential?.examCode ?? id}
          {credential?.status === 'beta' ? ' · BETA' : ''}
        </span>
        {!neutral && (
          <span>· {credential?.dungeonName ?? 'Historical dungeon'}</span>
        )}
        {(objectiveVersion ?? origin?.objectiveVersion) && (
          <span className="small muted">
            Map: {objectiveVersion ?? origin?.objectiveVersion}
          </span>
        )}
      </div>
      <p className="question-domain">
        {neutral ? 'Objective' : 'Floor'} ·{' '}
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
        {question.tags
          .filter((tag) => !authoringTags.has(tag))
          .map((tag) => (
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
  const tokens = question.codeSnippet.split(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|--[^\n]*|\b(?:SELECT|FROM|WHERE|AS|AND|OR|JOIN|ON|GROUP|BY|CREATE|TABLE|INSERT|INTO|WITH|ORDER|DESC|TRUE|FALSE|NULL|let|in|def|return|import|from|if|else|for|None|True|False|where|summarize|project|extend|join)\b|\b\d+(?:\.\d+)?\b)/g,
  );
  return (
    <div className="code-block">
      <span className="code-language">{question.codeLanguage}</span>
      <pre tabIndex={0} aria-label={`${question.codeLanguage} code snippet`}>
        <code>
          {tokens.map((token, index) => {
            const kind = /^["']/.test(token)
              ? 'string'
              : /^(#|--)/.test(token)
                ? 'comment'
                : /^\d/.test(token)
                  ? 'number'
                  : /^\w+$/.test(token)
                    ? 'keyword'
                    : '';
            return index % 2 === 1 && kind ? (
              <span key={index} className={`syntax-${kind}`}>
                {token}
              </span>
            ) : (
              token
            );
          })}
        </code>
      </pre>
    </div>
  );
}

export function QuestionExplanation({
  question,
  selected,
  revealAnswer,
  reaction = null,
}: {
  question: Question;
  selected: string[];
  revealAnswer: boolean;
  reaction?: Reaction | null;
}) {
  const correct = isCorrect(question, selected);
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
                ? 'Correct.'
                : !selected.length
                  ? 'Unanswered.'
                  : 'Incorrect.'}
            </h2>
          </div>
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
      {revealAnswer && <HostReaction reaction={reaction} />}
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
  reactionScope,
  credentialId,
  taxonomySnapshot,
  onClose,
}: {
  question: Question;
  groundedAt?: string | null;
  reactionScope?: string;
  credentialId?: string;
  taxonomySnapshot?: Taxonomy | null;
  onClose: () => void;
}) {
  const game = useGame();
  const { active } = game;
  const origin = active ? questionOrigin(active, question.id) : undefined;
  const id = credentialId ?? origin?.credentialId ?? game.selectedCredentialId;
  const dungeon = getDungeonPackage(id);
  const manifest =
    dungeon?.manifest ??
    (id === game.selectedCredentialId ? game.manifest : undefined);
  const taxonomy =
    taxonomySnapshot !== undefined
      ? taxonomySnapshot
      : (active?.objectiveSnapshots?.[id] ??
        dungeon?.taxonomy ??
        game.taxonomy);
  const snapshotGroundedAt =
    groundedAt === undefined ? origin?.groundedAt : groundedAt;
  const isCurrent = Boolean(
    manifest &&
    snapshotGroundedAt &&
    snapshotGroundedAt === manifest.lastGroundedAt,
  );
  const domain = taxonomy?.domains.find(
    (item) => item.id === question.objectiveDomain,
  );
  const skill = domain?.skills.find((item) => item.id === question.skill);
  const reaction = useReaction(
    reactionScope ?? active?.id ?? 'sources',
    `documentation:${question.id}`,
    ['tome-opened', 'documentation'],
    {
      domainId: domain?.id,
      domain: domain?.title,
      floorId: domain?.id,
      floor: domain?.title,
      skill: skill?.title,
      difficulty: question.difficulty,
      credentialId: id,
      dungeon: dungeon?.credential.dungeonName,
    },
  );
  return (
    <Modal
      title="The tome · sources behind this question"
      onClose={onClose}
      className="sources-modal"
    >
      <p className="muted">
        Direct official documentation, unchanged by the dungeon theme. Links
        open in a new tab only when you choose them.
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
          {snapshotGroundedAt ? (
            <>
              Historical question snapshot, grounded{' '}
              <DateStamp value={snapshotGroundedAt} precise />.
            </>
          ) : (
            <>A per-dungeon grounding date was not saved with this question.</>
          )}{' '}
          Current source-manifest summaries may differ, so this view uses the
          titles and URLs saved with your question. Per-source retrieval and
          review records are not stored with question snapshots.
        </p>
      )}
      <ol className="source-list">
        {question.sourceUrls.map((url, index) => {
          const source = isCurrent
            ? manifest?.sources.find(
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
              <p className="small muted">
                Source ID: {question.sourceIds[index]}
              </p>
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
      {question.verifiedAt && (
        <p className="small muted">
          Independent answer review recorded{' '}
          <DateStamp value={question.verifiedAt} precise />. This records the
          saved review, not a guarantee that documentation has not changed.
        </p>
      )}
      <HostReaction reaction={reaction} />
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
