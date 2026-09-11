import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  Database,
  Gauge,
  GitBranch,
  Layers3,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { useGame } from '../features/quiz/context';
import { defaultConfig } from '../features/quiz/types';
import { scoreSession } from '../features/results/scoring';
import { DateStamp, LearnLink } from '../components/common';
import { useReaction } from '../features/personality/useReaction';
import { HostReaction } from '../features/personality/HostReaction';
import { readBanterLevel } from '../features/personality/reactions';

function DataFlowVisual() {
  return (
    <div className="data-flow" aria-hidden="true">
      <svg className="flow-lines" viewBox="0 0 480 340" fill="none">
        <path d="M75 88H157Q177 88 177 108V149Q177 169 197 169H257M75 250H157Q177 250 177 230V189Q177 169 197 169H257M280 169H345Q365 169 365 149V88H406M280 169H345Q365 169 365 189V250H406" />
        <path
          className="flow-signal"
          d="M75 88H157Q177 88 177 108V149Q177 169 197 169H257"
        />
      </svg>
      <div className="flow-node flow-source">
        <Database size={22} />
        <span>Ingest</span>
      </div>
      <div className="flow-node flow-code">
        <Braces size={22} />
        <span>Transform</span>
      </div>
      <div className="flow-core">
        <div className="core-sheets">
          <Layers3 size={48} strokeWidth={1.5} />
        </div>
        <strong>
          Build your
          <br />
          Fabric fluency.
        </strong>
        <span>One challenge at a time.</span>
      </div>
      <div className="flow-node flow-target">
        <ShieldCheck size={22} />
        <span>Manage</span>
      </div>
      <div className="flow-node flow-chart">
        <Gauge size={22} />
        <span>Optimize</span>
      </div>
      <div className="flow-note">
        <span className="live-dot" /> Knowledge, connected.
      </div>
      <span className="flow-orbit orbit-one" />
      <span className="flow-orbit orbit-two" />
    </div>
  );
}

export function HomePage() {
  const { bank, taxonomy, manifest, history, active, setConfig, preferences } =
    useGame();
  const domainIcons = [ShieldCheck, GitBranch, Gauge];
  const returning = useReaction(
    `return:${history[0]?.id ?? 'new'}`,
    'returning',
    ['returning'],
    {},
    'context',
    history.length > 0,
  );
  const direct = readBanterLevel(preferences) === 'none';
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Fabric Data Engineer <span>Challenge</span>
            <span className="title-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="hero-subtitle">
            {direct
              ? 'DP-700 study and practice'
              : 'DP-700 Exam Prep Without the Boring Parts'}
          </p>
          <p className="hero-description">
            {direct
              ? 'Practice Fabric questions, review technical explanations, and identify topics for further study.'
              : 'Turn “I think I know this” into “I’ve got this.” Tackle practical Fabric questions, understand the why, and find your next learning move.'}
          </p>
          <HostReaction reaction={returning} />
          <div className="actions hero-actions">
            <Link className="button primary large" to="/setup">
              Configure challenge <ArrowRight size={20} aria-hidden="true" />
            </Link>
            {active ? (
              <Link className="button secondary" to="/play">
                <Play size={17} aria-hidden="true" /> Resume challenge
              </Link>
            ) : (
              <Link className="text-link" to="/about">
                How it works <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
          <div className="hero-assurances">
            <span>
              <Check size={15} aria-hidden="true" /> No sign-up
            </span>
            <span>
              <Check size={15} aria-hidden="true" /> Learn at your pace
            </span>
            <span>
              <Check size={15} aria-hidden="true" /> Yours, locally
            </span>
          </div>
        </div>
        <DataFlowVisual />
      </section>
      <section className="proof-strip" aria-label="About the question bank">
        <div>
          <BookOpen size={21} aria-hidden="true" />
          <p>
            <strong>{bank.length} original questions</strong>
            <span>Grounded in Microsoft Learn</span>
          </p>
        </div>
        <div>
          <Target size={21} aria-hidden="true" />
          <p>
            <strong>{taxonomy.domains.length} objective domains</strong>
            <span>Guide effective {taxonomy.studyGuideEffectiveDate}</span>
          </p>
        </div>
        <div>
          <Sparkles size={21} aria-hidden="true" />
          <p>
            <strong>Your challenge, your rules</strong>
            <span>Study, practice, or test yourself</span>
          </p>
        </div>
      </section>
      <section className="domains-section" aria-labelledby="domains-title">
        <div className="section-heading">
          <div>
            <h2 id="domains-title">Big skills. Bite-size challenges.</h2>
            <p>Explore the DP-700 objective map, one topic at a time.</p>
          </div>
          <LearnLink href={taxonomy.studyGuideUrl}>View study guide</LearnLink>
        </div>
        <div className="domain-grid">
          {taxonomy.domains.map((domain, index) => {
            const Icon = domainIcons[index % domainIcons.length];
            const count = bank.filter(
              (question) => question.objectiveDomain === domain.id,
            ).length;
            return (
              <article
                className={`domain-card domain-${index}`}
                key={domain.id}
              >
                <div className="domain-card-top">
                  <span className="domain-icon">
                    <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="domain-weight">
                    {domain.weightRange.join('–')}% of guide
                  </span>
                </div>
                <h3>{domain.title}</h3>
                <p>{domain.skills.length} skills to explore</p>
                <Link
                  className="domain-card-bottom"
                  to="/setup"
                  onClick={() =>
                    setConfig({
                      ...defaultConfig,
                      objectiveDomains: [domain.id],
                    })
                  }
                  aria-label={`Practice ${domain.title}: ${count} questions`}
                >
                  <span>
                    <strong>{count}</strong> questions in this bank
                  </span>
                  <ArrowUpRight size={19} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      <div className="home-bottom-grid">
        <section className="recent-section" aria-labelledby="recent-title">
          <div className="section-heading">
            <div>
              <h2 id="recent-title">Your learning trail</h2>
              <p>Small sessions add up.</p>
            </div>
            <span className="count-badge">{history.length} saved</span>
          </div>
          {history.length ? (
            <ol className="history-list">
              {history.slice(0, 5).map((result) => {
                const score = scoreSession(result, taxonomy);
                return (
                  <li key={result.id}>
                    <span className="history-score">{score.percentage}%</span>
                    <div>
                      <Link
                        className="history-link"
                        to={`/results/${result.id}`}
                      >
                        {score.total}-question challenge{' '}
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </Link>
                      <p>
                        <DateStamp value={result.completedAt} /> ·{' '}
                        {score.correct} correct · {score.missed.length} to
                        revisit
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="history-empty">
              <span className="empty-path" aria-hidden="true">
                <GitBranch size={28} />
              </span>
              <div>
                <h3>Your first step starts here.</h3>
                <p>
                  Complete a challenge to see your scores, progress, and topics
                  to revisit.
                </p>
                <Link to="/setup" className="text-link">
                  Let’s get started <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
          {history.length > 5 && (
            <details className="older-history">
              <summary>Show {history.length - 5} earlier sessions</summary>
              <ul>
                {history.slice(5).map((result) => (
                  <li key={result.id}>
                    <Link to={`/results/${result.id}`}>
                      <DateStamp value={result.completedAt} /> ·{' '}
                      {result.questions.length} questions ·{' '}
                      {scoreSession(result, taxonomy).percentage}%
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <aside className="grounding-note">
          <div className="grounding-heading">
            <ShieldCheck size={23} aria-hidden="true" />
            <h2>Know where the answers come from.</h2>
          </div>
          <p>
            Original practice questions, with direct documentation and
            explanations. Never real exam questions, leaked content, or dumps.
          </p>
          <dl>
            <div>
              <dt>Guide retrieved</dt>
              <dd>
                <DateStamp value={taxonomy.retrievedAt} />
              </dd>
            </div>
            <div>
              <dt>Last grounded · exact timestamp</dt>
              <dd>
                <DateStamp value={manifest.lastGroundedAt} precise />
              </dd>
            </div>
          </dl>
          <p className="small">
            A documented snapshot, not a promise of current coverage. Products
            and exam objectives can change.
          </p>
          <Link to="/about" className="text-link">
            Read our grounding approach{' '}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
