import { Link } from 'react-router-dom';
import { ArrowRight, Beer, Compass, Flame, Shield, Star } from 'lucide-react';
import { useGame } from '../features/quiz/context';
import { credentials, heroClasses } from '../features/dungeons/catalog';
import { getDungeonPackage } from '../features/dungeons/packages';
import { historyForCredential } from '../features/quiz/origins';
import {
  cosmeticProgress,
  discoveryProgress,
  historyInsights,
  scoreSession,
} from '../features/results/scoring';
import {
  DateStamp,
  EmptyState,
  LearnLink,
  PageHeading,
} from '../components/common';
import { HostReaction } from '../features/personality/HostReaction';
import { useReaction } from '../features/personality/useReaction';

export function TavernPage() {
  const {
    history,
    favoriteCredentialIds,
    selectedCredentialId,
    heroClassId,
    active,
  } = useGame();
  const progress = cosmeticProgress(history);
  const discovery = discoveryProgress(history, credentials);
  const heroClass = heroClasses.find((item) => item.id === heroClassId);
  const current = credentials.find(
    (item) => item.credentialId === selectedCredentialId,
  );
  const recent = history[0];
  const recentScore = recent ? scoreSession(recent) : undefined;
  const returning = useReaction(
    `tavern:${recent?.id ?? 'new'}`,
    'returning',
    ['returning'],
    {},
    'context',
    Boolean(recent) && !active,
  );
  return (
    <div className="tavern-page">
      <PageHeading
        title="The tavern."
        description="Set down the torch. See what you actually learned."
      />
      <section className="tavern-character" aria-label="Hero character sheet">
        <div className="hero-emblem">
          <Shield size={37} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div>
          <h2>{heroClass?.name ?? 'Wanderer'}</h2>
          <p>
            Level {progress.level} adventurer · {history.length} completed
            expeditions
          </p>
          <p>
            10 cosmetic XP per correct answer. A level every 100 XP. This is not
            a credential or mastery rating.
          </p>
        </div>
        <div className="tavern-xp">
          <strong>{progress.xp} XP</strong>
          <span>{progress.loot} cosmetic loot tokens</span>
        </div>
      </section>
      <HostReaction reaction={returning} />
      <div className="tavern-grid">
        <div>
          <section aria-labelledby="trail-heading">
            <div className="section-heading">
              <h2 id="trail-heading">Your expedition journal</h2>
              <Beer size={23} aria-hidden="true" />
            </div>
            {history.length ? (
              <ol className="history-list">
                {history.map((result) => {
                  const score = scoreSession(result);
                  return (
                    <li key={result.id}>
                      <span className="history-score">{score.percentage}%</span>
                      <div>
                        <Link
                          className="history-link"
                          to={`/results/${result.id}`}
                        >
                          {score.byDungeon
                            .map(
                              (item) =>
                                credentials.find(
                                  (entry) => entry.credentialId === item.id,
                                )?.examCode ?? item.id,
                            )
                            .join(' + ')}{' '}
                          · {score.total} encounters{' '}
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                        <p>
                          <DateStamp value={result.completedAt} /> ·{' '}
                          {score.correct} correct · {score.missed.length} to
                          revisit
                        </p>
                        <p className="small muted">
                          {score.byDungeon
                            .flatMap((item) => item.objectiveVersions)
                            .join(' · ')}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState title="Your first story is unwritten.">
                <p>
                  Complete an expedition to see honest scores, sampled floors,
                  and documentation for the concepts you missed.
                </p>
                <Link className="button primary" to="/">
                  <Flame size={17} aria-hidden="true" /> Find your first dungeon
                </Link>
              </EmptyState>
            )}
          </section>
          <section aria-labelledby="dungeon-progress-heading">
            <h2 id="dungeon-progress-heading">Evidence by dungeon</h2>
            <p className="small muted">
              Latest sampled skills per dungeon, not lifetime mastery. Raid
              answers stay with their source dungeon.
            </p>
            {credentials.map((credential) => {
              const ownHistory = historyForCredential(
                history,
                credential.credentialId,
              );
              if (!ownHistory.length) return null;
              const latest = scoreSession(ownHistory[0]);
              const insights = historyInsights(
                history,
                credential.credentialId,
              );
              const difference = insights.improvementPercentagePoints;
              const dungeon = getDungeonPackage(credential.credentialId);
              return (
                <article
                  className="dungeon-progress-row"
                  key={credential.credentialId}
                >
                  <h3>
                    {credential.examCode ?? credential.credentialId} ·{' '}
                    {credential.dungeonName}
                  </h3>
                  <p>
                    {latest.correct}/{latest.total} correct in the latest sample
                    · {ownHistory.length} saved runs
                  </p>
                  <dl>
                    <div>
                      <dt>Strongest sampled</dt>
                      <dd>
                        {latest.strongest[0]
                          ? `${latest.strongest[0].label} · ${latest.strongest[0].correct}/${latest.strongest[0].total}`
                          : 'No sampled skill'}
                      </dd>
                    </div>
                    <div>
                      <dt>Worth revisiting</dt>
                      <dd>
                        {latest.weakest[0]
                          ? `${latest.weakest[0].label} · ${latest.weakest[0].correct}/${latest.weakest[0].total}`
                          : 'No missed skills in this sample'}
                      </dd>
                    </div>
                    {difference !== null && (
                      <div>
                        <dt>Comparable run</dt>
                        <dd>
                          {difference > 0 ? '+' : ''}
                          {difference} percentage points.
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="sample-note">{insights.improvementReason}</p>
                  {insights.repeatedErrors.length > 0 && (
                    <details className="readiness-details">
                      <summary>
                        Recurring misses · {insights.repeatedErrors.length}{' '}
                        encounters
                      </summary>
                      {insights.repeatedErrors.length > 5 && (
                        <p className="small muted">
                          Showing the five most repeatedly missed encounters.
                        </p>
                      )}
                      <ul>
                        {insights.repeatedErrors.slice(0, 5).map((item) => {
                          const saved = ownHistory.find((run) =>
                            run.questions.some(
                              (question) => question.id === item.questionId,
                            ),
                          );
                          const question = saved?.questions.find(
                            (question) => question.id === item.questionId,
                          );
                          return (
                            <li key={item.questionId}>
                              {question?.subskill ?? item.questionId} ·{' '}
                              {item.misses} incorrect attempts · last missed{' '}
                              <DateStamp value={item.lastMissedAt} />
                              {saved && (
                                <>
                                  {' '}
                                  ·{' '}
                                  <Link to={`/review/${saved.id}`}>
                                    Review saved encounter
                                  </Link>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                  <p className="sample-note">
                    Fewer than five encounters in a skill is a small sample.
                    Repeated encounters are not independent evidence of mastery.
                  </p>
                  {!dungeon?.readiness.study && (
                    <p className="notice warning">
                      This dungeon is currently sealed. Historical results are
                      preserved.
                    </p>
                  )}
                  <div className="actions">
                    <Link
                      className="text-link"
                      to={`/dungeons/${credential.credentialId}`}
                    >
                      Return to dungeon{' '}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    {credential.officialUrls.studyGuide && (
                      <LearnLink href={credential.officialUrls.studyGuide}>
                        Official study guide
                      </LearnLink>
                    )}
                  </div>
                </article>
              );
            })}
            {!history.length && (
              <p className="muted">
                No completed encounters yet. No skill estimates have been
                inferred.
              </p>
            )}
          </section>
        </div>
        <div>
          <section className="tavern-recommendation">
            <h2>
              {active
                ? 'Your torch is still burning.'
                : recentScore?.missed.length
                  ? 'A chamber worth revisiting.'
                  : 'Choose the next step.'}
            </h2>
            <p>
              {active
                ? 'An unfinished run is still in memory. Continue it before starting another expedition.'
                : recentScore?.missed.length
                  ? `Your last run contains ${recentScore.missed.length} missed or unanswered encounters. That observed gap—not a guess about mastery—is why we recommend a cursed-chamber revisit.`
                  : history.length
                    ? 'Your latest sample has no misses. Try another floor or a harder difficulty for broader evidence; one clean run does not establish readiness.'
                    : 'Start with a short Torchlight Run: immediate explanations, direct documentation, and no clock.'}
            </p>
            <Link
              className="button primary"
              to={
                active
                  ? '/play'
                  : recentScore?.missed.length && recent
                    ? `/results/${recent.id}`
                    : '/'
              }
            >
              {active
                ? 'Continue run'
                : recentScore?.missed.length
                  ? 'Revisit cursed chambers'
                  : 'Explore the map'}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
          <section>
            <div className="section-heading">
              <h2>Favorite dungeons</h2>
              <Star size={21} aria-hidden="true" />
            </div>
            {favoriteCredentialIds.length ? (
              <ul className="tavern-dungeon-list">
                {favoriteCredentialIds.map((id) => {
                  const credential = credentials.find(
                    (item) => item.credentialId === id,
                  );
                  return credential ? (
                    <li key={id}>
                      <div>
                        <Link className="text-link" to={`/dungeons/${id}`}>
                          {credential.examCode ?? id} · {credential.dungeonName}
                        </Link>
                        <p>
                          {getDungeonPackage(id)?.readiness.study
                            ? 'Torchlight ready'
                            : 'Sealed — inspect the map for evidence gaps'}
                        </p>
                      </div>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : (
              <p className="muted">
                Star a dungeon on the map to keep it close. A favorite never
                bypasses a sealed door.
              </p>
            )}
          </section>
          <section>
            <h2>Last selected</h2>
            <p className="muted">
              {current?.dungeonName ?? 'No dungeon selected'}
            </p>
            <Link
              className="text-link"
              to={`/dungeons/${selectedCredentialId}`}
            >
              Inspect on map <Compass size={16} aria-hidden="true" />
            </Link>
          </section>
          {history.length > 0 && (
            <section>
              <h2>Practice by discovery area</h2>
              <ul className="tavern-dungeon-list">
                {discovery.byArea.map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.label}
                      {row.insufficient && <p>Small sample</p>}
                    </span>
                    <strong>
                      {row.correct}/{row.total}
                    </strong>
                  </li>
                ))}
              </ul>
              <details>
                <summary>Hero-class practice</summary>
                <ul className="tavern-dungeon-list">
                  {discovery.byClass.map((row) => (
                    <li key={row.id}>
                      <span>
                        {heroClasses.find((item) => item.id === row.id)?.name ??
                          row.id}
                      </span>
                      <strong>
                        {row.correct}/{row.total}
                      </strong>
                    </li>
                  ))}
                </ul>
              </details>
              <p className="small muted">
                Discovery groups overlap. These views cannot be added together
                and are not required credential bundles.
              </p>
            </section>
          )}
          <p className="small muted">
            Progress stays in this browser.{' '}
            <Link to="/settings">Manage or clear local study data.</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
