import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Castle,
  Map,
  Hammer,
  Beer,
  Monitor,
  Moon,
  Play,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { useGame } from '../features/quiz/context';
import { useAppearance } from '../hooks/useAppearance';
import { useSessionTimer } from '../hooks/useSessionTimer';
import type { QuestionFlagContext } from '../hooks/useQuestionFlag';
import { PersonalityProvider } from '../features/personality/PersonalityProvider';
import { getDungeonPersonalityExtensions } from '../features/dungeons/packages';

const personalityExtensions = getDungeonPersonalityExtensions();

export function Shell() {
  const {
    active,
    lastResult,
    preferences,
    setPreferences,
    storageError,
    notices,
  } = useGame();
  const location = useLocation();
  const navigate = useNavigate();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const activeId = useRef(active?.id);
  const [currentFlag, setCurrentFlag] = useState<{
    key: string;
    flagged: boolean;
  } | null>(null);
  const question = active?.questions[active.currentIndex];
  const questionKey = active && question ? `${active.id}:${question.id}` : '';
  const submittedFlag = active?.responses.find(
    (response) => response.questionId === question?.id,
  )?.flagged;
  const flagged =
    submittedFlag ??
    (currentFlag?.key === questionKey ? currentFlag.flagged : false);
  const flagContext: QuestionFlagContext = {
    flagged,
    setFlagged: (value) => setCurrentFlag({ key: questionKey, flagged: value }),
  };
  useAppearance(preferences);
  useSessionTimer(flagged);
  useEffect(() => {
    if (!active && lastResult && lastResult.id === activeId.current) {
      navigate(`/results/${lastResult.id}`, { replace: true });
    }
    activeId.current = active?.id;
  }, [active, lastResult, navigate]);
  useEffect(() => {
    const heading = main.current?.querySelector('h1');
    document.title = `${heading?.textContent ?? 'Dungeon map'} · The Certification Dungeon`;
    if (previousPath.current !== location.pathname) {
      main.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    previousPath.current = location.pathname;
  }, [location.pathname]);
  useEffect(() => {
    if (!active) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [active]);
  const links = [
    { to: '/', label: 'Dungeon map', icon: Map },
    { to: '/tavern', label: 'The tavern', icon: Beer },
    { to: '/setup', label: 'Prepare a run', icon: SlidersHorizontal },
    ...(active ? [{ to: '/play', label: 'Continue run', icon: Play }] : []),
    { to: '/forge', label: 'Encounter forge', icon: Hammer },
    { to: '/about', label: 'About & sources', icon: BookOpen },
    { to: '/settings', label: 'Settings', icon: Settings2 },
  ];
  const themeIcon =
    preferences.theme === 'dark'
      ? Moon
      : preferences.theme === 'light'
        ? Sun
        : Monitor;
  const ThemeIcon = themeIcon;
  const nextTheme =
    preferences.theme === 'dark'
      ? 'light'
      : preferences.theme === 'light'
        ? 'system'
        : 'dark';
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          // Keep the hash route intact when skipping to the main landmark.
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to main content
      </a>
      <aside className="sidebar">
        <Link
          to="/"
          className="brand"
          aria-label="The Certification Dungeon home"
        >
          <span className="brand-mark">
            <Castle size={29} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span>
            The Certification
            <span className="brand-secondary">Dungeon</span>
          </span>
        </Link>
        <p className="sidebar-caption">Your knowledge. Your adventure.</p>
        <nav aria-label="Primary navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              {to === '/play' && (
                <span className="live-dot" aria-hidden="true" />
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-mark">
            <ShieldCheck size={19} aria-hidden="true" />
            <strong>Local by design</strong>
          </div>
          <p>Your progress stays in this browser. No account. No telemetry.</p>
          <Link to="/about" className="text-link">
            Built on public docs <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link to="/" className="mobile-brand">
            <Castle size={23} aria-hidden="true" /> Certification Dungeon
          </Link>
          <span className="topbar-label">
            Bring curiosity. The torches are on us.
          </span>
          <div className="topbar-actions">
            <span className="local-badge">
              <span className="live-dot" aria-hidden="true" /> Local study app
            </span>
            <button
              className="icon-button"
              onClick={() =>
                setPreferences({ ...preferences, theme: nextTheme })
              }
              aria-label={`Theme: ${preferences.theme}. Switch to ${nextTheme}.`}
              title={`Switch to ${nextTheme} theme`}
            >
              <ThemeIcon size={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `mobile-nav-link${isActive ? ' active' : ''}`
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>
                {label === 'Prepare a run'
                  ? 'Prepare'
                  : label === 'Continue run'
                    ? 'Continue'
                    : label === 'About & sources'
                      ? 'About'
                      : label === 'Encounter forge'
                        ? 'Forge'
                        : label}
              </span>
            </NavLink>
          ))}
        </nav>
        <main id="main-content" ref={main} tabIndex={-1}>
          {storageError && (
            <div className="notice warning" role="alert">
              <strong>Local storage needs attention.</strong> {storageError} You
              can keep studying, but changes may not survive a reload.
            </div>
          )}
          {notices.length > 0 && (
            <div className="notice" role="status" aria-label="Study notices">
              {notices.map((notice) => (
                <p key={notice}>{notice}</p>
              ))}
            </div>
          )}
          {active && location.pathname !== '/play' && (
            <div className="resume-strip">
              <span>
                <strong>An expedition is in progress.</strong>{' '}
                {active.config.timerMode === 'off'
                  ? 'You can return without losing your place.'
                  : 'Its timer continues while you browse.'}
              </span>
              <Link className="text-link" to="/play">
                Continue run <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          )}
          <PersonalityProvider extensions={personalityExtensions}>
            <Outlet context={flagContext} />
          </PersonalityProvider>
        </main>
        <footer className="site-footer">
          <span>Original encounters. Documented answers. Zero exam dumps.</span>
          <span>
            Unofficial study aid · Not affiliated with or endorsed by Microsoft
            or GitHub. Not a practice assessment.
          </span>
          <Link to="/about">About this project</Link>
        </footer>
      </div>
    </div>
  );
}
