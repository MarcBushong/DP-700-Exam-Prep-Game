import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppRoutes } from '../src/App';
import { content } from '../src/features/grounding/content';
import {
  GameContext,
  type GameContextValue,
} from '../src/features/quiz/context';
import {
  defaultConfig,
  defaultPreferences,
  type ActiveSession,
} from '../src/features/quiz/types';
import { makeResponse, selectQuestions } from '../src/features/quiz/engine';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  );
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function game(overrides: Partial<GameContextValue> = {}): GameContextValue {
  return {
    bank: content.questions,
    taxonomy: content.taxonomy,
    manifest: content.manifest,
    config: { ...defaultConfig },
    preferences: { ...defaultPreferences },
    active: null,
    lastResult: null,
    history: [],
    storageError: null,
    notices: [],
    setConfig: vi.fn(),
    setPreferences: vi.fn(),
    startSession: vi.fn(() => true),
    submitAnswer: vi.fn(),
    nextQuestion: vi.fn(),
    expireTimer: vi.fn(),
    finishSession: vi.fn(),
    abandonSession: vi.fn(),
    clearLocalData: vi.fn(),
    ...overrides,
  };
}

function session(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    id: 'interface-session',
    config: { ...defaultConfig, questionCount: 1 },
    questions: [content.questions[0]],
    responses: [],
    currentIndex: 0,
    startedAt: new Date().toISOString(),
    groundedAt: content.manifest.lastGroundedAt,
    questionStartedAt: Date.now(),
    ...overrides,
  };
}

function mount(value: GameContextValue, path = '/') {
  return render(
    <GameContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </GameContext.Provider>,
  );
}

describe('accessible challenge interface', () => {
  it('shows original content totals, exact grounding time, and the accessible entry point', async () => {
    const user = userEvent.setup();
    mount(game());
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Fabric Data Engineer Challenge/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('DP-700 Exam Prep Without the Boring Parts'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${content.questions.length} original questions`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(content.manifest.lastGroundedAt),
    ).toBeInTheDocument();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    await user.tab();
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('focuses the main content after a subsequent SPA route transition', async () => {
    const user = userEvent.setup();
    mount(game());
    await user.click(
      within(screen.getByRole('main')).getByRole('link', {
        name: 'Configure challenge',
      }),
    );
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Make this challenge yours.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('shows the exact smaller-bank warning before a challenge begins', () => {
    const question = content.questions[0];
    const config = {
      ...defaultConfig,
      questionCount: 50,
      subskills: [question.subskill],
    };
    const value = game({ config });
    const selection = selectQuestions(
      content.questions,
      content.taxonomy,
      config,
    );
    mount(value, '/setup');
    expect(selection.eligibleCount).toBeLessThan(50);
    expect(screen.getByText(selection.warnings[0])).toBeInTheDocument();
    expect(value.startSession).not.toHaveBeenCalled();
  });

  it('clears incompatible child filters when their parent domain is removed', async () => {
    const user = userEvent.setup();
    const [first, second] = content.taxonomy.domains;
    const config = {
      ...defaultConfig,
      objectiveDomains: [first.id, second.id],
      skills: [first.skills[0].id],
      subskills: [first.skills[0].subskills[0]],
    };
    const value = game({ config });
    mount(value, '/setup');
    await user.click(
      screen.getByRole('checkbox', { name: new RegExp(`^${first.title}`) }),
    );
    expect(value.setConfig).toHaveBeenCalledWith({
      ...config,
      objectiveDomains: [second.id],
      skills: [],
      subskills: [],
    });
  });

  it('validates custom counts instead of silently starting with an invalid number', async () => {
    const user = userEvent.setup();
    const value = game();
    mount(value, '/setup');
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    const count = screen.getByRole('spinbutton', {
      name: 'Custom question count (1–50)',
    });
    await user.clear(count);
    await user.type(count, '51');
    expect(count).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByRole('button', { name: 'Begin challenge' }),
    ).toBeDisabled();
    expect(value.startSession).not.toHaveBeenCalled();
  });

  it('supports keyboard answer selection and submits exact choice IDs', async () => {
    const user = userEvent.setup();
    const question = content.questions.find(
      (item) => item.questionType === 'single-select',
    );
    if (!question)
      throw new Error('The bank must include a single-select question.');
    const value = game({ active: session({ questions: [question] }) });
    mount(value, '/play');
    expect(
      screen.getByRole('button', { name: 'Submit answer' }),
    ).toBeDisabled();
    const choice = screen.getByRole('radio', {
      name: question.answerChoices[0].text,
    });
    choice.focus();
    await user.keyboard('[Space]');
    expect(choice).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(value.submitAnswer).toHaveBeenCalledWith(
      [question.answerChoices[0].id],
      false,
    );
  });

  it('supports multiple checkbox answers without turning them into radio choices', async () => {
    const user = userEvent.setup();
    const question = content.questions.find(
      (item) => item.questionType === 'multi-select',
    );
    if (!question)
      throw new Error('The bank must include a multi-select question.');
    const value = game({ active: session({ questions: [question] }) });
    mount(value, '/play');
    const first = screen.getByRole('checkbox', {
      name: question.answerChoices[0].text,
    });
    first.focus();
    await user.keyboard('[Space]');
    await user.click(
      screen.getByRole('checkbox', { name: question.answerChoices[1].text }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(value.submitAnswer).toHaveBeenCalledWith(
      [question.answerChoices[0].id, question.answerChoices[1].id],
      false,
    );
  });

  it.each(['hidden', 'exam'] as const)(
    'never leaks feedback, sources, or streaks in %s mode before completion',
    (answerMode) => {
      const question = content.questions[0];
      const active = session({
        config: { ...defaultConfig, answerMode },
        responses: [
          makeResponse(
            question,
            question.correctAnswer,
            false,
            Date.now(),
            Date.now(),
          ),
        ],
      });
      mount(game({ active }), '/play');
      expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
      expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /View sources/ }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/current streak/)).not.toBeInTheDocument();
      const choices = screen
        .getAllByRole(
          question.questionType === 'multi-select' ? 'checkbox' : 'radio',
        )
        .filter((input) => input.getAttribute('name')?.startsWith('answer-'));
      expect(choices.length).toBeGreaterThan(0);
      choices.forEach((input) => expect(input).toBeDisabled());
      expect(
        screen.getByRole('button', { name: 'View results' }),
      ).toBeEnabled();
    },
  );

  it.each([
    [
      'immediate',
      'Submit your answer to unlock sources and full explanations for this question.',
    ],
    [
      'explanations-only',
      'Concept explanations unlock after submission. Correctness, answers, distractor analysis, and sources wait until completion.',
    ],
  ] as const)(
    'describes the correct pre-submit feedback timing in %s mode',
    (answerMode, message) => {
      mount(
        game({ active: session({ config: { ...defaultConfig, answerMode } }) }),
        '/play',
      );
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(
        screen.queryByText(
          'Sources and full explanations unlock when your session is complete.',
        ),
      ).not.toBeInTheDocument();
    },
  );

  it('reveals only concept explanations in explanations-only mode', () => {
    const question = content.questions[0];
    const active = session({
      config: { ...defaultConfig, answerMode: 'explanations-only' },
      responses: [
        makeResponse(
          question,
          question.correctAnswer,
          false,
          Date.now(),
          Date.now(),
        ),
      ],
    });
    mount(game({ active }), '/play');
    expect(screen.getByText(question.explanation)).toBeInTheDocument();
    expect(screen.getByText(question.deepExplanation)).toBeInTheDocument();
    expect(
      screen.queryByText('Why the other choices don’t fit'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Correct. Nicely/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /View sources/ }),
    ).not.toBeInTheDocument();
  });

  it('opens a labelled study sources dialog and returns focus when it closes', async () => {
    const user = userEvent.setup();
    mount(
      game({
        active: session({ config: { ...defaultConfig, answerMode: 'study' } }),
      }),
      '/play',
    );
    const trigger = screen.getByRole('button', { name: 'View sources' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', {
      name: 'The sources behind this question',
    });
    const link = within(dialog).getAllByRole('link')[0];
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent(
      dialog,
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps a full-session timer active during feedback', () => {
    const question = content.questions[0];
    const past = Date.now() - 15_000;
    const active = session({
      config: { ...defaultConfig, timerMode: 'session', timerSeconds: 10 },
      startedAt: new Date(past).toISOString(),
      questionStartedAt: past,
      responses: [
        makeResponse(
          question,
          question.correctAnswer,
          false,
          past,
          past + 1000,
        ),
      ],
    });
    const value = game({ active });
    mount(value, '/play');
    expect(value.expireTimer).toHaveBeenCalled();
  });

  it('preserves an unsubmitted flag when the timer expires on another route', async () => {
    const user = userEvent.setup();
    const started = Date.now();
    const value = game({
      active: session({
        config: { ...defaultConfig, timerMode: 'session', timerSeconds: 10 },
        startedAt: new Date(started).toISOString(),
        questionStartedAt: started,
      }),
    });
    mount(value, '/play');
    await user.click(screen.getByRole('checkbox', { name: 'Flag for review' }));
    await user.click(
      within(
        screen.getByRole('navigation', { name: 'Primary navigation' }),
      ).getByRole('link', { name: 'About & sources' }),
    );
    expect(value.expireTimer).not.toHaveBeenCalled();
    vi.spyOn(Date, 'now').mockReturnValue(started + 11_000);
    await waitFor(() => expect(value.expireTimer).toHaveBeenCalledWith(true));
  });

  it('passes the current unsubmitted flag to explicit early completion', async () => {
    const user = userEvent.setup();
    const value = game({ active: session() });
    mount(value, '/play');
    await user.click(screen.getByRole('checkbox', { name: 'Flag for review' }));
    await user.click(screen.getByRole('button', { name: 'Finish early' }));
    expect(value.finishSession).not.toHaveBeenCalled();
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Finish this challenge early?' }),
      ).getByRole('button', { name: 'Finish & score session' }),
    );
    expect(value.finishSession).toHaveBeenCalledWith(true);
  });

  it('does not carry a pending flag into another question', async () => {
    const user = userEvent.setup();
    const active = session({ questions: content.questions.slice(0, 2) });
    const value = game({ active });
    const { rerender } = mount(value, '/play');
    await user.click(screen.getByRole('checkbox', { name: 'Flag for review' }));
    const nextValue = { ...value, active: { ...active, currentIndex: 1 } };
    rerender(
      <GameContext.Provider value={nextValue}>
        <MemoryRouter initialEntries={['/play']}>
          <AppRoutes />
        </MemoryRouter>
      </GameContext.Provider>,
    );
    expect(
      screen.getByRole('checkbox', { name: 'Flag for review' }),
    ).not.toBeChecked();
  });

  it('stops the per-question timer after submission', () => {
    const question = content.questions[0];
    const past = Date.now() - 15_000;
    const active = session({
      config: { ...defaultConfig, timerMode: 'question', timerSeconds: 10 },
      startedAt: new Date(past).toISOString(),
      questionStartedAt: past,
      responses: [
        makeResponse(
          question,
          question.correctAnswer,
          false,
          past,
          past + 1000,
        ),
      ],
    });
    const value = game({ active });
    mount(value, '/play');
    expect(value.expireTimer).not.toHaveBeenCalled();
    expect(screen.getByRole('timer')).toHaveAccessibleName(
      'Question timer: 9 seconds remaining',
    );
  });

  it('requires explicit confirmation before clearing only the app data', async () => {
    const user = userEvent.setup();
    const value = game();
    mount(value, '/settings');
    await user.click(
      screen.getByRole('button', { name: 'Clear local study data' }),
    );
    expect(value.clearLocalData).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', {
      name: 'Clear this app’s local data?',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Clear local study data' }),
    );
    expect(value.clearLocalData).toHaveBeenCalledOnce();
  });

  it('provides a recoverable direct link for missing historical results', () => {
    mount(game(), '/results/not-in-this-browser');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'This result isn’t in this browser.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View saved sessions' }),
    ).toHaveAttribute('href', '/');
  });
});
