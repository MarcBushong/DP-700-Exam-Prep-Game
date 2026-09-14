import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Flame,
  LockKeyhole,
  Map,
  Search,
  ShieldCheck,
  Star,
  Swords,
} from 'lucide-react';
import {
  credentials,
  heroClasses,
  type Credential,
} from '../features/dungeons/catalog';
import { getDungeonPackage } from '../features/dungeons/packages';
import { useGame } from '../features/quiz/context';
import { defaultConfig, type QuizConfig } from '../features/quiz/types';
import {
  ConfirmDialog,
  DateStamp,
  EmptyState,
  LearnLink,
} from '../components/common';
import { DungeonArt } from '../components/DungeonArt';
import { useReaction } from '../features/personality/useReaction';
import { HostReaction } from '../features/personality/HostReaction';
import { historyForCredential } from '../features/quiz/origins';
import { scoreSession } from '../features/results/scoring';

export function DungeonMapPage() {
  const {
    selectedCredentialId,
    selectDungeon,
    favoriteCredentialIds,
    toggleFavoriteCredential,
    heroClassId,
    setHeroClassId,
    history,
    active,
    abandonSession,
    setConfig,
  } = useGame();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const [level, setLevel] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [focusedId, setFocusedId] = useState(routeId ?? selectedCredentialId);
  const [pending, setPending] = useState<{
    id: string;
    mode: QuizConfig['runMode'];
    weak: boolean;
  } | null>(null);
  const heroClass = heroClasses.find((item) => item.id === heroClassId);
  const areas = [
    ...new Set(credentials.flatMap((item) => item.productAreas)),
  ].sort();
  const levels = [
    ...new Set(credentials.flatMap((item) => (item.level ? [item.level] : []))),
  ].sort();
  const filtered = credentials.filter(
    (item) =>
      (item.credentialId === routeId ||
        !heroClass ||
        heroClass.id === 'wanderer' ||
        heroClass.credentialIds.includes(item.credentialId)) &&
      (!area || item.productAreas.includes(area)) &&
      (!level || item.level === level) &&
      (!favoritesOnly || favoriteCredentialIds.includes(item.credentialId)) &&
      [item.examCode, item.currentName, item.dungeonName, ...item.productAreas]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const groups = [
    ...new Set(filtered.map((item) => item.productAreas[0] ?? 'Other realms')),
  ];
  const focused = credentials.find((item) => item.credentialId === focusedId);
  const openCount = credentials.filter(
    (item) => getDungeonPackage(item.credentialId)?.readiness.study,
  ).length;
  const returning = useReaction(
    `map:${history[0]?.id ?? 'new'}`,
    'returning',
    ['returning'],
    {},
    'context',
    history.length > 0 && !active,
  );
  const enter = (id: string, mode: QuizConfig['runMode'], weak = false) => {
    const dungeon = getDungeonPackage(id);
    if (!dungeon?.readiness[mode === 'gauntlet' ? 'gauntlet' : 'study']) return;
    if (!selectDungeon(id)) return;
    setConfig({
      ...defaultConfig,
      credentialId: id,
      runMode: mode,
      raidCredentialIds: undefined,
      answerMode: mode === 'gauntlet' ? 'exam' : 'immediate',
      practiceMode: weak ? 'weak' : 'all',
      order: weak ? 'weakest' : 'balanced',
    });
    navigate('/setup');
  };
  const requestEnter = (
    id: string,
    mode: QuizConfig['runMode'],
    weak = false,
  ) => {
    if (active) setPending({ id, mode, weak });
    else enter(id, mode, weak);
  };
  return (
    <div className="dungeon-map-page">
      <section className="dungeon-map-hero">
        <div className="dungeon-hero-copy">
          <h1>
            The Certification <span>Dungeon</span>
          </h1>
          <p className="dungeon-hero-lead">
            Real skills. Unreasonable amounts of adventure.
          </p>
          <p>
            Choose your realm, light a torch, and put your knowledge to the
            test. You’re the hero. The documentation has the last word.
          </p>
          <div className="actions">
            <a
              className="button primary"
              href="#dungeon-catalog"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById('dungeon-catalog')?.focus();
                document
                  .getElementById('dungeon-catalog')
                  ?.scrollIntoView({ block: 'start' });
              }}
            >
              <Map size={18} aria-hidden="true" /> Find your dungeon
            </a>
            <Link className="text-link" to="/tavern">
              Visit the tavern <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="dungeon-disclaimer">
            Unofficial study aid. Original questions, not a real exam or
            practice assessment.
          </p>
        </div>
        <DungeonArt />
      </section>
      <div className="map-legend" aria-label="Catalog readiness">
        <span>
          <Flame size={18} aria-hidden="true" />
          <strong>{openCount}</strong> open dungeons
        </span>
        <span>
          <LockKeyhole size={17} aria-hidden="true" />
          <strong>{credentials.length - openCount}</strong> sealed or preparing
        </span>
        <span>
          <ShieldCheck size={18} aria-hidden="true" /> Only verified encounters
          enter play
        </span>
      </div>
      <HostReaction reaction={returning} />
      <section
        className="hero-class-picker"
        aria-labelledby="hero-class-heading"
      >
        <div>
          <Compass size={28} aria-hidden="true" />
          <h2 id="hero-class-heading">Choose your hero class</h2>
          <p>
            Public industry roles for discovery, never a required credential
            bundle.
          </p>
        </div>
        <div className="field">
          <label htmlFor="hero-class">Hero class</label>
          <select
            id="hero-class"
            value={heroClassId}
            onChange={(event) => setHeroClassId(event.target.value)}
          >
            {heroClasses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <p className="field-help">
            {heroClass?.description ?? 'Explore every realm.'}
          </p>
        </div>
      </section>
      <section
        id="dungeon-catalog"
        tabIndex={-1}
        aria-labelledby="catalog-heading"
      >
        <div className="section-heading">
          <div>
            <h2 id="catalog-heading">The dungeon map</h2>
            <p>A door is only open when its evidence is ready.</p>
          </div>
          <span className="count-badge" role="status">
            {filtered.length} dungeons shown
          </span>
        </div>
        <div className="catalog-controls">
          <div className="field catalog-search">
            <label htmlFor="dungeon-search">Search dungeons</label>
            <div className="search-input">
              <Search size={18} aria-hidden="true" />
              <input
                id="dungeon-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Code, credential, or technology"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="product-area">Technology</label>
            <select
              id="product-area"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            >
              <option value="">All technologies</option>
              {areas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dungeon-level">Level</label>
            <select
              id="dungeon-level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="">All levels</option>
              {levels.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <label className="check-label favorite-filter">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
            />
            <Star size={16} aria-hidden="true" /> Favorites only
          </label>
        </div>
        <div className="field quick-dungeon">
          <label htmlFor="quick-dungeon">Inspect a dungeon</label>
          <select
            id="quick-dungeon"
            value={
              filtered.some((item) => item.credentialId === focusedId)
                ? focusedId
                : ''
            }
            onChange={(event) => setFocusedId(event.target.value)}
          >
            <option value="">Choose from the map</option>
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {filtered
                  .filter(
                    (item) =>
                      (item.productAreas[0] ?? 'Other realms') === group,
                  )
                  .map((item) => (
                    <option key={item.credentialId} value={item.credentialId}>
                      {item.examCode ?? item.credentialId} · {item.dungeonName}{' '}
                      ·{' '}
                      {getDungeonPackage(item.credentialId)?.readiness.study
                        ? 'Open'
                        : 'Sealed'}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        {focused && (
          <div className="map-selection" aria-live="polite">
            <span>
              On your map:{' '}
              <strong>
                {focused.examCode ?? focused.credentialId} ·{' '}
                {focused.dungeonName}
              </strong>
            </span>
            <button
              className="text-button"
              onClick={() =>
                document
                  .getElementById(`dungeon-${focused.credentialId}`)
                  ?.scrollIntoView({ block: 'center' })
              }
            >
              Locate card
            </button>
          </div>
        )}
        {routeId &&
          !credentials.some((item) => item.credentialId === routeId) && (
            <p className="notice warning" role="alert">
              This dungeon is not in the verified catalog. No encounters can be
              loaded from this address.
            </p>
          )}
        {!filtered.length && (
          <EmptyState title="No dungeons on this part of the map.">
            <p>
              Try another class or clear your search and filters. Sealed
              dungeons remain visible when they match.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setQuery('');
                setArea('');
                setLevel('');
                setFavoritesOnly(false);
                setHeroClassId('wanderer');
              }}
            >
              Explore everything
            </button>
          </EmptyState>
        )}
        {groups.map((group) => (
          <section className="realm-group" aria-label={group} key={group}>
            <h3 className="realm-heading">{group}</h3>
            <div className="dungeon-grid">
              {filtered
                .filter(
                  (item) => (item.productAreas[0] ?? 'Other realms') === group,
                )
                .map((credential) => (
                  <DungeonCard
                    key={credential.credentialId}
                    credential={credential}
                    selected={focusedId === credential.credentialId}
                    favorite={favoriteCredentialIds.includes(
                      credential.credentialId,
                    )}
                    onFavorite={() =>
                      toggleFavoriteCredential(credential.credentialId)
                    }
                    onEnter={requestEnter}
                  />
                ))}
            </div>
          </section>
        ))}
      </section>
      <section className="map-grounding-note">
        <BookOpen size={26} aria-hidden="true" />
        <div>
          <h2>Some doors should stay closed.</h2>
          <p>
            Study requires at least 25 verified encounters across every major
            floor. Boss Gauntlets require at least 75, skill breadth, and
            boss-tier reasoning. These are product safeguards, not official exam
            requirements. Missing evidence never becomes a made-up question.
          </p>
          <Link className="text-link" to="/forge">
            See the encounter forge <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      {pending && (
        <ConfirmDialog
          title="Abandon your current expedition?"
          confirmLabel="Abandon & prepare"
          onClose={() => setPending(null)}
          onConfirm={() => {
            abandonSession();
            enter(pending.id, pending.mode, pending.weak);
          }}
          destructive
        >
          <p>
            Your unfinished answers will be discarded, not scored. Completed
            history stays in the tavern. Cancel to keep your current run.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function DungeonCard({
  credential,
  favorite,
  selected,
  onFavorite,
  onEnter,
}: {
  credential: Credential;
  favorite: boolean;
  selected: boolean;
  onFavorite: () => void;
  onEnter: (id: string, mode: QuizConfig['runMode'], weak?: boolean) => void;
}) {
  const dungeon = getDungeonPackage(credential.credentialId);
  const { history } = useGame();
  const ready = Boolean(dungeon?.readiness.study);
  const recent = historyForCredential(history, credential.credentialId)[0];
  const recentScore = recent ? scoreSession(recent) : undefined;
  const areaIndex = [
    ...new Set(credentials.map((item) => item.productAreas[0])),
  ].indexOf(credential.productAreas[0]);
  return (
    <article
      id={`dungeon-${credential.credentialId}`}
      className={`dungeon-card biome-${areaIndex % 5}${ready ? ' dungeon-open' : ' dungeon-sealed'}${selected ? ' selected-dungeon' : ''}`}
      aria-label={`${credential.examCode ?? credential.credentialId} ${credential.dungeonName}`}
    >
      <div className="dungeon-card-art">
        <DungeonArt compact />
        <div className="card-topline">
          <span className={`readiness-tag ${ready ? 'ready' : ''}`}>
            {ready ? (
              <Flame size={14} aria-hidden="true" />
            ) : (
              <LockKeyhole size={14} aria-hidden="true" />
            )}
            {ready ? 'Torchlight ready' : 'Sealed dungeon'}
          </span>
          <button
            className="favorite-button"
            aria-pressed={favorite}
            aria-label={`${favorite ? 'Unfavorite' : 'Favorite'} ${credential.examCode ?? credential.credentialId}`}
            onClick={onFavorite}
          >
            <Star
              size={19}
              aria-hidden="true"
              fill={favorite ? 'currentColor' : 'none'}
            />
          </button>
        </div>
        <p className="card-biome">{credential.themeMetadata.biome}</p>
      </div>
      <div className="dungeon-card-body">
        <div className="dungeon-code">
          <strong>{credential.examCode ?? credential.credentialId}</strong>
          <span>{credential.level ?? 'Level unverified'}</span>
        </div>
        <h4>{credential.dungeonName}</h4>
        <p className="official-name">
          {credential.currentName ?? 'Official identity awaiting verification'}
        </p>
        <div className="encounter-count">
          <strong>{dungeon?.questions.length ?? 0}</strong>
          <span>
            playable verified encounters
            <br />
            <small>
              {dungeon?.taxonomy.domains.length
                ? `${dungeon.taxonomy.domains.length} documented floors`
                : 'Objective map not loaded'}
            </small>
          </span>
        </div>
        {(dungeon?.reviewedQuestions.length ?? 0) >
          (dungeon?.questions.length ?? 0) && (
          <p className="small muted">
            {dungeon?.reviewedQuestions.length} fully reviewed encounters remain
            unavailable because the credential or mode gates are not met.
          </p>
        )}
        <dl className="dungeon-facts">
          <div>
            <dt>Credential status</dt>
            <dd>
              {credential.status}
              {!credential.isVerified ? ' · unverified' : ''}
            </dd>
          </div>
          <div>
            <dt>Content</dt>
            <dd>{credential.contentReadiness}</dd>
          </div>
          <div>
            <dt>Danger tier</dt>
            <dd>
              {credential.themeMetadata.difficultyTier ?? 'Set when preparing'}
            </dd>
          </div>
          <div>
            <dt>Grounded</dt>
            <dd>
              {credential.lastGroundedAt ? (
                <DateStamp value={credential.lastGroundedAt} />
              ) : (
                'Awaiting evidence'
              )}
            </dd>
          </div>
          <div>
            <dt>Objective version</dt>
            <dd>
              {dungeon?.objectiveVersion ??
                credential.objectiveVersion ??
                'No verified map'}
            </dd>
          </div>
        </dl>
        {!ready && (
          <p className="sealed-reason">
            {credential.sealedReason ??
              dungeon?.readiness.reasons[0] ??
              'Awaiting a verified map and independently reviewed encounters.'}
          </p>
        )}
        <div className="card-entry-actions">
          <button
            className="button primary"
            disabled={!ready}
            onClick={() => onEnter(credential.credentialId, 'study')}
          >
            <Flame size={17} aria-hidden="true" />
            {ready ? 'Descend' : 'Sealed'}
            {ready && <ArrowRight size={17} aria-hidden="true" />}
          </button>
          <button
            className="button secondary"
            disabled={!dungeon?.readiness.gauntlet}
            onClick={() => onEnter(credential.credentialId, 'gauntlet')}
          >
            <Swords size={16} aria-hidden="true" /> Boss Gauntlet
          </button>
        </div>
        {!dungeon?.readiness.gauntlet && (
          <details className="readiness-details">
            <summary>Why is the gauntlet sealed?</summary>
            <ul>
              {(dungeon?.readiness.reasons.length
                ? dungeon.readiness.reasons
                : [credential.sealedReason ?? 'Verified package unavailable.']
              ).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        )}
        {recent && (
          <div className="card-recent">
            {recentScore && (
              <p className="small muted">
                Latest sample: {recentScore.percentage}% · {recentScore.total}{' '}
                encounters · {recentScore.byDomain.length} floors. Not a mastery
                estimate.
              </p>
            )}
            <Link className="text-link" to={`/results/${recent.id}`}>
              Last run · <DateStamp value={recent.completedAt} />
            </Link>
            <button
              className="text-button"
              disabled={!ready}
              onClick={() => onEnter(credential.credentialId, 'study', true)}
            >
              Revisit cursed chambers
            </button>
          </div>
        )}
        {credential.officialUrls.studyGuide && (
          <LearnLink href={credential.officialUrls.studyGuide}>
            Official objective map
          </LearnLink>
        )}
      </div>
    </article>
  );
}
