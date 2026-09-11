import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { GameProvider } from '../src/features/quiz/GameProvider';
import { useGame } from '../src/features/quiz/context';
import { defaultConfig } from '../src/features/quiz/types';
import { loadData, STORAGE_KEY } from '../src/services/storage';
import { question } from './fixtures';

function Harness() {
  const game = useGame();
  return (
    <div>
      <p>Theme: {game.preferences.theme}</p>
      <p>Completed: {game.history.length}</p>
      <p>Question: {game.active?.questions[0].id ?? 'none'}</p>
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
