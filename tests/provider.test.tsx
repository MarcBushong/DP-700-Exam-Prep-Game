import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { GameProvider } from '../src/features/quiz/GameProvider';
import { useGame } from '../src/features/quiz/context';
import { defaultConfig } from '../src/features/quiz/types';
import { loadData, STORAGE_KEY } from '../src/services/storage';
import { question } from './fixtures';

vi.mock('../src/features/dungeons/packages', async () => {
  const { question: fixture } = await import('./fixtures');
  const { dungeon } = await import('./runtime-fixtures');
  const base = dungeon('dp-700', [
    fixture(),
    fixture('next'),
    fixture('stale', { verificationStatus: 'stale' }),
    fixture('manual', { requiresManualReview: true }),
  ]);
  const other = dungeon('other', [fixture('other-q')]);
  other.taxonomy.domains[0].title = 'Other floor';
  const locked = dungeon('locked');
  locked.credential.status = 'retired';
  const studyOnly = dungeon('study-only', [fixture('study-only-q')]);
  studyOnly.readiness.gauntlet = false;
  const stale = dungeon('stale');
  stale.credential.objectiveVersion = 'Changed map';
  return {
    getDungeonPackage: (id: string) =>
      [base, other, locked, studyOnly, stale].find(
        (p) => p.credential.credentialId === id,
      ),
  };
});

function Harness() {
  const game = useGame();
  return (
    <div>
      <p>Theme: {game.preferences.theme}</p>
      <p>Completed: {game.history.length}</p>
      <p>
        Question:{' '}
        {game.active?.questions[game.active.currentIndex].id ?? 'none'}
      </p>
      <p>Recent: {game.recentQuestionIds.join(', ') || 'none'}</p>
      <p>Banter: {game.preferences.banterLevel}</p>
      <p>Dungeon: {game.selectedCredentialId}</p>
      <p>Floor: {game.taxonomy.domains[0].title}</p>
      <p>Favorites: {game.favoriteCredentialIds.join(', ')}</p>
      <p>Class: {game.heroClassId}</p>
      <p>Mode: {game.active?.config.answerMode ?? 'none'}</p>
      <p>Notices: {game.notices.join(' ')}</p>
      {game.storageError && <p role="alert">{game.storageError}</p>}
      <button
        onClick={() =>
          game.setPreferences({ ...game.preferences, theme: 'light' })
        }
      >
        Set light theme
      </button>
      <button onClick={() => game.startSession(defaultConfig, [question()])}>
        Start fixture
      </button>
      <button onClick={() => game.submitAnswer(['a'], true)}>
        Answer fixture
      </button>
      <button onClick={game.nextQuestion}>Continue</button>
      <button onClick={game.clearLocalData}>Clear fixture data</button>
      <button onClick={game.resetQuestionHistory}>
        Reset question history
      </button>
      <button
        onClick={() =>
          game.setPreferences({ ...game.preferences, banterLevel: 'none' })
        }
      >
        No banter
      </button>
      <button
        onClick={() =>
          game.startSession({ ...defaultConfig, questionCount: 2 }, [
            question(),
            question('next'),
          ])
        }
      >
        Start two
      </button>
      <button onClick={game.abandonSession}>Abandon</button>
      <button onClick={() => game.selectDungeon('other')}>Select other</button>
      <button onClick={() => game.selectDungeon('dp-700')}>
        Select DP-700
      </button>
      <button onClick={() => game.selectDungeon('locked')}>
        Select locked
      </button>
      <button onClick={() => game.selectDungeon('stale')}>Select stale</button>
      <button
        onClick={() =>
          game.startSession({ ...game.config, credentialId: 'locked' })
        }
      >
        Bypass locked
      </button>
      <button onClick={() => game.startSession(game.config)}>
        Start current
      </button>
      <button
        onClick={() => {
          game.abandonSession();
          game.selectDungeon('other');
        }}
      >
        Abandon and select other
      </button>
      <button
        onClick={() => {
          game.selectDungeon('study-only');
          game.startSession({
            ...defaultConfig,
            credentialId: 'study-only',
            answerMode: 'exam',
          });
        }}
      >
        Bypass gauntlet
      </button>
      <button onClick={() => game.toggleFavoriteCredential('dp-700')}>
        Favorite DP-700
      </button>
      <button onClick={() => game.setHeroClassId('data-engineer')}>
        Data engineer
      </button>
      <button
        onClick={() =>
          game.startSession(defaultConfig, [
            question('q1', {
              correctAnswer: ['b'],
              verificationStatus: 'stale',
            }),
            question('stale'),
            question('manual'),
            question('removed'),
          ])
        }
      >
        Retry snapshots
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

it('persists completed sessions and settings across provider remounts', async () => {
  const user = userEvent.setup();
  const mounted = render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Set light theme' }));
  await user.click(screen.getByRole('button', { name: 'Start fixture' }));
  await user.click(screen.getByRole('button', { name: 'Answer fixture' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() =>
    expect(loadData(localStorage).data.history).toHaveLength(1),
  );
  expect(loadData(localStorage).data.history[0].responses[0].flagged).toBe(
    true,
  );
  mounted.unmount();
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  expect(screen.getByText('Theme: light')).toBeInTheDocument();
  expect(screen.getByText('Completed: 1')).toBeInTheDocument();
  expect(screen.getByText('Question: none')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear fixture data' }));
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(screen.getByText('Completed: 0')).toBeInTheDocument();
});

it('blocks locked, stale and direct-call bypasses and gates legacy exam mode', async () => {
  const user = userEvent.setup();
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  for (const name of ['Select locked', 'Select stale', 'Bypass locked']) {
    await user.click(screen.getByRole('button', { name }));
    expect(screen.getByText('Dungeon: dp-700')).toBeInTheDocument();
    expect(screen.getByText('Question: none')).toBeInTheDocument();
  }
  await user.click(screen.getByRole('button', { name: 'Bypass gauntlet' }));
  expect(screen.getByText('Dungeon: study-only')).toBeInTheDocument();
  expect(screen.getByText('Question: none')).toBeInTheDocument();
  expect(screen.getByText(/^Notices:/)).toHaveTextContent('Gauntlet');
});

it('changes content/maps only after explicit abandonment and scopes recent history', async () => {
  const user = userEvent.setup();
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Start fixture' }));
  await user.click(screen.getByRole('button', { name: 'Select other' }));
  expect(screen.getByText('Dungeon: dp-700')).toBeInTheDocument();
  expect(screen.getByText('Question: q1')).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Abandon and select other' }),
  );
  expect(screen.getByText('Dungeon: other')).toBeInTheDocument();
  expect(screen.getByText('Floor: Other floor')).toBeInTheDocument();
  expect(screen.getByText('Recent: none')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Start current' }));
  expect(screen.getByText('Question: other-q')).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Reset question history' }),
  );
  await user.click(screen.getByRole('button', { name: 'Abandon' }));
  await user.click(screen.getByRole('button', { name: 'Select DP-700' }));
  expect(screen.getByText('Recent: q1')).toBeInTheDocument();
});

it('persists favorite dungeons and hero class without clearing scores or settings', async () => {
  const user = userEvent.setup();
  const mounted = render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Favorite DP-700' }));
  await user.click(screen.getByRole('button', { name: 'Data engineer' }));
  await waitFor(() =>
    expect(loadData(localStorage).data.heroClassId).toBe('data-engineer'),
  );
  mounted.unmount();
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  expect(screen.getByText('Favorites: dp-700')).toBeInTheDocument();
  expect(screen.getByText('Class: data-engineer')).toBeInTheDocument();
});

it('surfaces damaged stored data on startup without overwriting it', () => {
  localStorage.setItem(STORAGE_KEY, '{"version":99}');
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('unsupported');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{"version":99}');
});

it('does not overwrite damaged originals when the user changes settings in memory', async () => {
  const raw = '{"version":99}';
  localStorage.setItem(STORAGE_KEY, raw);
  const user = userEvent.setup();
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Set light theme' }));
  expect(screen.getByText('Theme: light')).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it('persists only shown IDs, including abandoned sessions, and resets them without scores/settings', async () => {
  const user = userEvent.setup();
  const mounted = render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Start fixture' }));
  await user.click(screen.getByRole('button', { name: 'Answer fixture' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'No banter' }));
  await user.click(screen.getByRole('button', { name: 'Start two' }));
  await user.click(screen.getByRole('button', { name: 'Abandon' }));
  const before = loadData(localStorage).data;
  expect(before.recentQuestionIds).toEqual(['next', 'q1']);
  expect(before.history).toHaveLength(1);
  mounted.unmount();
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  expect(screen.getByText('Recent: next, q1')).toBeInTheDocument();
  expect(screen.getByText('Banter: none')).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Reset question history' }),
  );
  await waitFor(() =>
    expect(loadData(localStorage).data.recentQuestionIds).toEqual([]),
  );
  expect(loadData(localStorage).data.history).toEqual(before.history);
  expect(loadData(localStorage).data.preferences).toEqual(before.preferences);
});

it('resolves retry IDs to current verified questions and preserves shuffled answer identities', async () => {
  const user = userEvent.setup();
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Retry snapshots' }));
  expect(screen.getByText('Question: q1')).toBeInTheDocument();
  expect(screen.getByText(/^Notices:/)).toHaveTextContent(
    '3 missed question(s)',
  );
  await user.click(screen.getByRole('button', { name: 'Answer fixture' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  const saved = loadData(localStorage).data.history[0];
  expect(saved.questions).toHaveLength(1);
  expect(saved.questions[0].correctAnswer).toEqual(['a']);
  expect(saved.questions[0].verificationStatus).toBe('verified');
  expect(saved.responses[0].selectedAnswer).toEqual(['a']);
  expect(
    new Set(saved.questions[0].answerChoices.map((choice) => choice.id)),
  ).toEqual(new Set(['a', 'b', 'c']));
});
