import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Database,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import { useGame } from '../features/quiz/context';
import {
  ConfirmDialog,
  DateStamp,
  LearnLink,
  PageHeading,
} from '../components/common';

export function SettingsPage() {
  const { preferences, setPreferences, history, active, clearLocalData } =
    useGame();
  const [clearOpen, setClearOpen] = useState(false);
  return (
    <div className="information-page">
      <PageHeading
        title="A space that suits you."
        description="A few thoughtful settings. No account required."
      />
      <section className="panel settings-section">
        <h2>Make yourself comfortable.</h2>
        <fieldset className="theme-field">
          <legend>Appearance</legend>
          <div className="theme-options">
            {(
              [
                { value: 'dark', label: 'Dark ink', icon: Moon },
                { value: 'light', label: 'Warm light', icon: Sun },
                { value: 'system', label: 'Follow system', icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <label
                className={`theme-option ${preferences.theme === value ? 'selected' : ''}`}
                key={value}
              >
                <input
                  type="radio"
                  name="theme"
                  checked={preferences.theme === value}
                  onChange={() =>
                    setPreferences({ ...preferences, theme: value })
                  }
                />
                <Icon size={23} aria-hidden="true" />
                <span>{label}</span>
                <span
                  className={`theme-preview theme-preview-${value}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="preference-option">
          <span>
            <strong>Reduce playful banter</strong>
            <small>
              Keep answer feedback direct. Technical explanations stay the same.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={preferences.reducedBanter}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                reducedBanter: event.target.checked,
              })
            }
          />
        </label>
        <label className="preference-option">
          <span>
            <strong>Reduce motion</strong>
            <small>
              Remove decorative animation and transitions. Your system’s
              reduced-motion preference is always respected too.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={preferences.reducedMotion}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                reducedMotion: event.target.checked,
              })
            }
          />
        </label>
      </section>
      <section className="panel settings-section">
        <div className="section-title">
          <Database size={23} aria-hidden="true" />
          <h2>Your data, in this browser.</h2>
        </div>
        <p>
          Preferences, your challenge configuration, and up to 30 completed
          sessions are stored locally. You currently have{' '}
          <strong>
            {history.length} saved session{history.length === 1 ? '' : 's'}
          </strong>
          .
        </p>
        <p className="notice">
          <strong>Reloading resets an in-progress quiz.</strong> Active
          questions live in memory only. Completed history and settings survive
          reloads when browser storage is available.
        </p>
        <p>
          No telemetry, analytics, account, or cloud sync. Clearing this app’s
          data doesn’t clear other sites or other browser storage.
        </p>
        <div className="danger-zone">
          <div>
            <h3>Start fresh</h3>
            <p>
              Delete saved results and settings for this app
              {active ? ', and discard your active challenge' : ''}. This cannot
              be undone.
            </p>
          </div>
          <button className="button danger" onClick={() => setClearOpen(true)}>
            <Trash2 size={17} aria-hidden="true" /> Clear local study data
          </button>
        </div>
      </section>
      {clearOpen && (
        <ConfirmDialog
          title="Clear this app’s local data?"
          confirmLabel="Clear local study data"
          onClose={() => setClearOpen(false)}
          onConfirm={clearLocalData}
          destructive
        >
          <p>
            This permanently removes this app’s {history.length} completed
            session{history.length === 1 ? '' : 's'}, saved filters, and
            preferences from this browser. Any in-progress challenge will also
            be discarded. Other applications’ data is not touched.
          </p>
          <p>Download any results you want to keep before continuing.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export function AboutPage() {
  const { taxonomy, manifest, bank } = useGame();
  const certification = manifest.sources.find((source) =>
    /\/credentials\/certifications\/fabric-data-engineer-associate\/?$/.test(
      source.url,
    ),
  );
  const course = manifest.sources.find((source) =>
    /\/training\/courses\/dp-700t00\/?$/.test(source.url),
  );
  return (
    <div className="about-page">
      <PageHeading
        title="Built for learning. Not for shortcuts."
        description="An independent, local practice space for aspiring Fabric data engineers."
      />
      <section className="about-intro panel">
        <ShieldCheck size={34} aria-hidden="true" />
        <div>
          <h2>Unofficial. Original. Transparent.</h2>
          <p>
            Fabric Data Engineer Challenge is an unofficial study aid. It is{' '}
            <strong>
              not affiliated with, sponsored by, or endorsed by Microsoft or
              Microsoft Certification
            </strong>
            .
          </p>
          <p>
            These are original questions based on public documentation. They are
            not actual exam questions, leaked questions, exam dumps, or
            reconstructions of private exam content. Scores do not predict
            certification outcomes.
          </p>
          <p>
            Microsoft, Microsoft Fabric, and other product names and trademarks
            belong to their respective owners. No official logos are used.
          </p>
        </div>
      </section>
      <div className="about-columns">
        <section>
          <h2>How the content is grounded</h2>
          <p>
            Microsoft Learn MCP is used during content preparation to retrieve
            public documentation. The retrieved material supports a reviewed,
            build-time question bank and source manifest.
          </p>
          <p>
            <strong>No model or AI service runs in this app.</strong> Questions
            are selected from {bank.length} bundled originals; adaptive mode
            rearranges remaining questions, rather than generating content.
          </p>
          <dl className="about-dates">
            <div>
              <dt>Study guide effective date</dt>
              <dd>{taxonomy.studyGuideEffectiveDate}</dd>
            </div>
            <div>
              <dt>Guide retrieved</dt>
              <dd>
                <DateStamp value={taxonomy.retrievedAt} precise />
              </dd>
            </div>
            <div>
              <dt>Last grounded</dt>
              <dd>
                <DateStamp value={manifest.lastGroundedAt} precise />
              </dd>
            </div>
            <div>
              <dt>Retrieval method</dt>
              <dd>{manifest.retrievalMethod}</dd>
            </div>
          </dl>
          <p>
            This is a dated snapshot, not a claim of always-current coverage.
            Product behavior, preview features, and exam objectives can change.
            Verify the linked documentation and current study guide.
          </p>
        </section>
        <section>
          <h2>What happens to your data?</h2>
          <p>
            Study sessions run locally in your browser. No cloud service, API
            key, runtime AI, sign-in, telemetry, or analytics is required.
          </p>
          <p>
            After the app is served locally, it makes no external network
            requests. Documentation links go to Microsoft Learn only when you
            choose to open them.
          </p>
          <p>
            Completed results and preferences are saved in this browser. Active
            quizzes are in memory only and reset if you reload. The app keeps
            your most recent 30 completed sessions; downloaded results are yours
            to keep.
          </p>
          <Link className="text-link" to="/settings">
            Manage local study data <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <h2>What your score means</h2>
          <p>
            Scoring is exact-match, with no partial credit or time bonuses.
            Missed and unanswered questions count against the score. A small
            starter bank cannot fully represent exam coverage or difficulty.
          </p>
          <p>
            Categories with fewer than five questions are marked as small
            samples. Mastery summaries reflect sampled practice, never a promise
            of passing.
          </p>
        </section>
      </div>
      <section className="panel official-resources">
        <div className="section-title">
          <BookOpen size={23} aria-hidden="true" />
          <h2>Go straight to the source.</h2>
        </div>
        <ul>
          <li>
            <LearnLink href={taxonomy.studyGuideUrl}>
              DP-700 study guide and measured objectives
            </LearnLink>
          </li>
          <li>
            <LearnLink
              href={
                certification?.url ??
                'https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/'
              }
            >
              {certification?.title ??
                'Microsoft Certified: Fabric Data Engineer Associate'}
            </LearnLink>
          </li>
          <li>
            <LearnLink
              href={
                course?.url ??
                'https://learn.microsoft.com/en-us/training/courses/dp-700t00'
              }
            >
              {course?.title ??
                'DP-700: Implementing Data Engineering Solutions Using Microsoft Fabric'}
            </LearnLink>
          </li>
        </ul>
        <p className="small muted">
          The study guide is the authority for exam objectives. Use the
          certification page and course for official requirements and training.
        </p>
      </section>
      <section className="source-catalog">
        <h2>Explore the grounding library</h2>
        <p className="muted">
          {manifest.sources.length} documented sources. Question-level source
          panels show exactly which references support each answer.
        </p>
        <details className="panel">
          <summary>
            View all documentation sources ({manifest.sources.length})
          </summary>
          <ul>
            {manifest.sources.map((source) => (
              <li key={source.sourceId}>
                <LearnLink href={source.url}>{source.title}</LearnLink>
                <p>{source.shortSummary}</p>
                <p className="small muted">
                  {source.featureStatus} · Retrieved{' '}
                  <DateStamp value={source.retrievedAt} /> · Reviewed{' '}
                  <DateStamp value={source.lastReviewedAt} />
                </p>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <section className="not-found">
      <span className="not-found-code">404</span>
      <h1>This path doesn’t lead to a question.</h1>
      <p>
        The page may have moved, or the address may be incomplete. Your next
        challenge is still waiting.
      </p>
      <div className="actions">
        <Link to="/" className="button primary">
          Back to overview <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/setup" className="button secondary">
          Configure challenge
        </Link>
      </div>
    </section>
  );
}
