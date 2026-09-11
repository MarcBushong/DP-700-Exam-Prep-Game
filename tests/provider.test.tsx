import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { GameProvider } from '../src/features/quiz/GameProvider';
import { useGame } from '../src/features/quiz/context';
import { defaultConfig } from '../src/features/quiz/types';
import { loadData, STORAGE_KEY } from '../src/services/storage';
import { question } from './fixtures';

vi.mock('../src/features/grounding/content', async () => {
  const { question: fixture, taxonomy, date } = await import('./fixtures');
  return {
    content: {
      questions: [
        fixture(),
        fixture('next'),
        fixture('stale', { verificationStatus: 'stale' }),
        fixture('manual', { requiresManualReview: true }),
      ],
      taxonomy,
      manifest: {
        schemaVersion: 1,
        lastGroundedAt: date,
        retrievalMethod: 'Microsoft Learn MCP',
        sources: [],
      },
    },
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
