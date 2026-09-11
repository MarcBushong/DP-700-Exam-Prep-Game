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
import { getDungeonPackage } from '../src/features/dungeons/packages';
import * as dungeonPackages from '../src/features/dungeons/packages';
import { credentials, heroClasses } from '../src/features/dungeons/catalog';
import {
  result as makeResult,
  question as makeQuestion,
  taxonomy,
  manifest,
} from './fixtures';

// UI contracts use synthetic fixtures; real shuffled-bank journeys run in Playwright.
const content = {
  taxonomy,
  manifest,
  questions: [
    makeQuestion('ui-single'),
    makeQuestion('ui-multi', {
      questionType: 'multi-select',
      correctAnswer: ['a', 'c'],
      objectiveDomain: 'ingest',
      skill: 'batch',
      subskill: 'Loading',
      difficulty: 'advanced',
    }),
    makeQuestion('ui-expert', {
      objectiveDomain: 'monitor',
      skill: 'performance',
      subskill: 'Tuning',
      difficulty: 'expert',
    }),
    makeQuestion('ui-second'),
  ],
};

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
    selectedCredentialId: 'dp-700',
    selectedDungeon: getDungeonPackage('dp-700'),
    selectDungeon: vi.fn(() => true),
    favoriteCredentialIds: [],
    toggleFavoriteCredential: vi.fn(),
    heroClassId: 'wanderer',
    setHeroClassId: vi.fn(),
    credentialHistory: [],
    bank: content.questions,
    taxonomy: content.taxonomy,
    manifest: content.manifest,
    config: { ...defaultConfig },
    preferences: { ...defaultPreferences },
    active: null,
    lastResult: null,
    history: [],
    recentQuestionIds: [],
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
    resetQuestionHistory: vi.fn(),
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
  it('filters dungeon cards with a keyboard-accessible search and native grouped selector', async () => {
    const user = userEvent.setup();
    mount(game());
    const search = screen.getByRole('searchbox', { name: 'Search dungeons' });
    await user.type(search, 'DP-700');
    const article = screen.getByRole('article', { name: /DP-700/ });
    expect(article).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(
      screen
        .getByRole('combobox', { name: 'Inspect a dungeon' })
        .querySelector('optgroup'),
    ).not.toBeNull();
    await user.clear(search);
    await user.type(search, 'definitely-not-a-credential');
    expect(
      screen.getByRole('heading', {
        name: 'No dungeons on this part of the map.',
      }),
    ).toBeVisible();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('uses public hero-class mapping and preserves favorites independently of readiness', async () => {
    const user = userEvent.setup();
    const value = game();
    mount(value);
    const hero = heroClasses.find((item) => item.id !== 'wanderer');
    expect(hero).toBeDefined();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Hero class' }),
      hero!.id,
    );
    expect(value.setHeroClassId).toHaveBeenCalledWith(hero!.id);
    await user.click(screen.getByRole('button', { name: 'Favorite DP-700' }));
    expect(value.toggleFavoriteCredential).toHaveBeenCalledWith('dp-700');
    await user.click(screen.getByRole('checkbox', { name: 'Favorites only' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('keeps verified identities sealed when their encounter package is not installed', async () => {
    const user = userEvent.setup();
    vi.spyOn(dungeonPackages, 'getDungeonPackage').mockReturnValue(undefined);
    const locked = credentials.find(
      (item) => item.isVerified && item.status === 'active',
    );
    expect(locked).toBeDefined();
    const value = game();
    mount(value, `/dungeons/${locked!.credentialId}`);
    const card = screen.getByRole('article', {
      name: `${locked!.examCode ?? locked!.credentialId} ${locked!.dungeonName}`,
    });
    expect(within(card).getByRole('button', { name: 'Sealed' })).toBeDisabled();
    expect(
      within(card).getByRole('button', { name: 'Boss Gauntlet' }),
    ).toBeDisabled();
    expect(within(card).getByText('Objective map not loaded')).toBeVisible();
    expect(
      within(card).queryByText('0 documented floors'),
    ).not.toBeInTheDocument();
    await user.click(within(card).getByText('Why is the gauntlet sealed?'));
    expect(card.querySelector('.readiness-details li')).toBeVisible();
    expect(value.selectDungeon).not.toHaveBeenCalled();
  });

  it('requires abandoning the active run before entering a ready dungeon', async () => {
    const original = getDungeonPackage('dp-700');
    if (!original) throw new Error('Default package required for UI fixture.');
    vi.spyOn(dungeonPackages, 'getDungeonPackage').mockImplementation((id) =>
      id === 'dp-700'
        ? {
            ...original,
            questions: content.questions,
            readiness: {
              study: true,
              gauntlet: false,
              reasons: ['Synthetic fixture: gauntlet breadth unavailable.'],
            },
          }
        : undefined,
    );
    const user = userEvent.setup();
    const value = game({ active: session() });
    mount(value);
    await user.click(
      within(screen.getByRole('article', { name: /DP-700/ })).getByRole(
        'button',
        { name: 'Descend' },
      ),
    );
    expect(value.selectDungeon).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', {
      name: 'Abandon your current expedition?',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Abandon & prepare' }),
    );
    expect(value.abandonSession).toHaveBeenCalledOnce();
    expect(value.selectDungeon).toHaveBeenCalledWith('dp-700');
    expect(value.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialId: 'dp-700',
        runMode: 'study',
        answerMode: 'immediate',
        timerMode: 'off',
      }),
    );
  });

  it('cannot bypass a sealed gauntlet through the legacy exam reveal mode', () => {
    const original = getDungeonPackage('dp-700');
    if (!original) throw new Error('Default package required for UI fixture.');
    vi.spyOn(dungeonPackages, 'getDungeonPackage').mockReturnValue({
      ...original,
      readiness: {
        study: true,
        gauntlet: false,
        reasons: ['Synthetic fixture: breadth missing.'],
      },
    });
    mount(game({ config: { ...defaultConfig, answerMode: 'exam' } }), '/setup');
    expect(screen.getByRole('button', { name: 'Descend' })).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: /^Boss Gauntlet/ }),
    ).toBeDisabled();
    expect(screen.getByRole('radio', { name: /^Exam mode/ })).toBeDisabled();
  });

  it('shows boss framing outside the unchanged technical scenario and keeps gauntlets neutral', () => {
    const question = content.questions[1];
    const value = game({
      active: session({ questions: [question] }),
      preferences: { ...defaultPreferences, banterLevel: 'full' },
    });
    const { container, rerender } = mount(value, '/play');
    const banner = screen.getByRole('complementary', {
      name: 'Boss encounter framing',
    });
    expect(banner).toBeVisible();
    expect(container.querySelector('legend.question-title')).toHaveTextContent(
      question.question,
    );
    expect(banner).not.toContainElement(
      container.querySelector('legend.question-title'),
    );
    const nextValue = {
      ...value,
      active: session({
        questions: [question],
        config: {
          ...defaultConfig,
          runMode: 'gauntlet',
          answerMode: 'immediate',
        },
      }),
    };
    rerender(
      <GameContext.Provider value={nextValue}>
        <MemoryRouter initialEntries={['/play']}>
          <AppRoutes />
        </MemoryRouter>
      </GameContext.Provider>,
    );
    expect(
      screen.queryByRole('complementary', { name: 'Boss encounter framing' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/HP/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Open tome/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-reaction-id]')).toHaveLength(0);
  });

  it('keeps the forge sealed when no verified objective map exists', async () => {
    const user = userEvent.setup();
    vi.spyOn(dungeonPackages, 'getDungeonPackage').mockReturnValue(undefined);
    mount(game(), '/forge');
    const locked = credentials.find((item) => item.credentialId !== 'dp-700')!;
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Dungeon to extend' }),
      locked.credentialId,
    );
    expect(
      screen.getByRole('button', { name: 'Download request' }),
    ).toBeDisabled();
    expect(screen.getByText(/No objectives have been inferred/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Copy commands' }),
    ).not.toBeInTheDocument();
  });

  it('retains migration notices beside the new comfort controls', () => {
    mount(
      game({
        notices: ['Saved DP-700 history was preserved during migration.'],
        preferences: {
          ...defaultPreferences,
          reducedMotion: true,
          banterLevel: 'reduced',
          reducedBanter: true,
        },
      }),
      '/settings',
    );
    expect(
      screen.getByRole('status', { name: 'Study notices' }),
    ).toHaveTextContent('history was preserved');
    expect(screen.getByRole('switch', { name: /Calm dungeon/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Reduced/ })).toBeChecked();
  });

  it('shows original content totals, exact grounding time, and the accessible entry point', async () => {
    const user = userEvent.setup();
    mount(game());
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /The Certification Dungeon/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Real skills. Unreasonable amounts of adventure.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Hero class' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Inspect a dungeon' }),
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
      within(
        screen.getByRole('navigation', { name: 'Primary navigation' }),
      ).getByRole('link', {
        name: 'Prepare a run',
      }),
    );
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Prepare your expedition.',
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
    expect(screen.getByRole('button', { name: 'Descend' })).toBeDisabled();
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

  it('supports the advertised submit shortcut without guessing an answer', async () => {
    const user = userEvent.setup();
    const sample = content.questions[0];
    const value = game({ active: session() });
    mount(value, '/play');
    await user.keyboard('{Alt>}{Enter}{/Alt}');
    expect(value.submitAnswer).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('radio', { name: sample.answerChoices[0].text }),
    );
    await user.keyboard('{Alt>}{Enter}{/Alt}');
    expect(value.submitAnswer).toHaveBeenCalledWith(
      [sample.answerChoices[0].id],
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
    expect(
      screen.getByText(
        `Choose ${question.correctAnswer.length} answers. Exact match required; no partial credit.`,
      ),
    ).toBeVisible();
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
      const { container } = mount(
        game({
          active,
          preferences: { ...defaultPreferences, banterLevel: 'full' },
        }),
        '/play',
      );
      expect(container.querySelectorAll('[data-reaction-id]')).toHaveLength(0);
      expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
      expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /view sources/ }),
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
    const { container } = mount(
      game({
        active,
        preferences: { ...defaultPreferences, banterLevel: 'full' },
      }),
      '/play',
    );
    expect(container.querySelectorAll('[data-reaction-id]')).toHaveLength(0);
    expect(screen.getByText(question.explanation)).toBeInTheDocument();
    expect(screen.getByText(question.deepExplanation)).toBeInTheDocument();
    expect(
      screen.queryByText('Why the other choices don’t fit'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Correct. Nicely/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /view sources/ }),
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
    const trigger = screen.getByRole('button', {
      name: 'Open tome · view sources',
    });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', {
      name: 'The tome · sources behind this question',
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

  it.each([
    {
      label: 'current',
      groundedAt: manifest.lastGroundedAt,
      showSummary: true,
    },
    {
      label: 'stale',
      groundedAt: '2026-08-10T16:05:00.000Z',
      showSummary: false,
    },
    { label: 'missing', groundedAt: undefined, showSummary: false },
  ])(
    'uses the $label per-dungeon grounding snapshot rather than the raid timestamp in the tome',
    async ({ groundedAt, showSummary }) => {
      const user = userEvent.setup();
      vi.spyOn(dungeonPackages, 'getDungeonPackage').mockReturnValue(undefined);
      const question = content.questions[0];
      const result = {
        ...makeResult([question]),
        config: { ...defaultConfig, runMode: 'raid' as const },
        groundedAt: showSummary
          ? '2026-08-10T16:05:00.000Z'
          : manifest.lastGroundedAt,
        questionOrigins: {
          [question.id]: {
            credentialId: 'dp-700',
            objectiveVersion: 'test-version',
            groundedAt,
          },
        },
        objectiveSnapshots: { 'dp-700': taxonomy },
      };
      mount(game({ history: [result] }), `/review/${result.id}`);
      await user.click(
        screen.getByRole('button', {
          name: 'Open tome · sources & objective alignment',
        }),
      );
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByRole('link', {
          name: `${question.documentationTitles[0]} (opens official documentation in a new tab)`,
        }),
      ).toHaveAttribute('href', question.sourceUrls[0]);
      if (showSummary) {
        expect(
          within(dialog).getByText(manifest.sources[0].shortSummary),
        ).toBeVisible();
      } else {
        expect(
          within(dialog).queryByText(manifest.sources[0].shortSummary),
        ).not.toBeInTheDocument();
        expect(
          within(dialog).getByText(/no summary has been inferred/),
        ).toBeVisible();
      }
    },
  );

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

  it.each(['full', 'balanced', 'reduced', 'none'] as const)(
    'saves the %s banter setting without changing other preferences',
    async (banterLevel) => {
      const user = userEvent.setup();
      const value = game({
        preferences: {
          ...defaultPreferences,
          theme: 'light',
          reducedMotion: true,
          banterLevel: banterLevel === 'none' ? 'full' : 'none',
        },
      });
      mount(value, '/settings');
      const names = {
        full: 'Full',
        balanced: 'Balanced',
        reduced: 'Reduced',
        none: 'Silent',
      };
      await user.click(
        screen.getByRole('radio', {
          name: new RegExp(`^${names[banterLevel]}`),
        }),
      );
      expect(value.setPreferences).toHaveBeenCalledWith({
        ...value.preferences,
        banterLevel,
        reducedBanter: banterLevel === 'reduced' || banterLevel === 'none',
      });
    },
  );

  it('resets only recent question history after explicit confirmation', async () => {
    const user = userEvent.setup();
    const value = game({
      recentQuestionIds: ['seen-1'],
      history: [makeResult([content.questions[0]])],
    });
    const { rerender } = mount(value, '/settings');
    await user.click(
      screen.getByRole('button', { name: 'Reset question history' }),
    );
    expect(value.resetQuestionHistory).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', {
      name: 'Reset recently shown questions?',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Reset question history' }),
    );
    expect(value.resetQuestionHistory).toHaveBeenCalledOnce();
    expect(value.clearLocalData).not.toHaveBeenCalled();
    expect(value.setPreferences).not.toHaveBeenCalled();
    rerender(
      <GameContext.Provider
        value={{
          ...value,
          recentQuestionIds: [],
          notices: [
            'Recent question history reset. Saved scores and preferences are unchanged.',
          ],
        }}
      >
        <MemoryRouter initialEntries={['/settings']}>
          <AppRoutes />
        </MemoryRouter>
      </GameContext.Provider>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(
      screen.getByRole('status', { name: 'Study notices' }),
    ).toHaveTextContent('Saved scores and preferences are unchanged.');
  });

  it('announces the answer result and explanation ahead of non-live humor', () => {
    const question = content.questions[0];
    const active = session({
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
    const { container } = mount(game({ active }), '/play');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(
      `Correct. Explanation: ${question.explanation}`,
    );
    expect(container.querySelector('.feedback-wrap')).toHaveFocus();
    const reaction = container.querySelector<HTMLElement>('[data-reaction-id]');
    expect(reaction).not.toBeNull();
    expect(reaction).toHaveAttribute('aria-live', 'off');
    expect(status).not.toContainElement(reaction);
    expect(status).not.toHaveTextContent(
      reaction?.textContent ?? 'missing reaction',
    );
  });

  it.each(['none', 'reduced', 'balanced', 'full'] as const)(
    'applies %s consistently to answer, source, result, and returning surfaces',
    async (banterLevel) => {
      const user = userEvent.setup();
      const question = content.questions[0];
      const result = makeResult([question], [question.id]);
      const active = session({
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
      const value = game({
        active,
        history: [result],
        preferences: { ...defaultPreferences, banterLevel },
      });
      const { container } = mount(value, '/play');
      expect(
        container.querySelectorAll('.question-feedback [data-reaction-id]'),
      ).toHaveLength(
        banterLevel === 'full' || banterLevel === 'balanced' ? 1 : 0,
      );
      expect(screen.getByRole('heading', { name: 'Correct.' })).toBeVisible();
      await user.click(
        screen.getByRole('button', { name: 'Open tome · view sources' }),
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog.querySelectorAll('[data-reaction-id]')).toHaveLength(
        banterLevel === 'full' ? 1 : 0,
      );
      await user.click(within(dialog).getByRole('button', { name: /^Close/ }));
      await user.click(
        within(
          screen.getByRole('navigation', { name: 'Primary navigation' }),
        ).getByRole('link', { name: 'The tavern' }),
      );
      expect(
        container.querySelectorAll('[data-reaction-category="returning"]'),
      ).toHaveLength(0);
      await user.click(
        screen.getByRole('link', { name: /DP-700 · 1 encounters/ }),
      );
      expect(
        container.querySelectorAll(
          '[data-reaction-category="session-complete"]',
        ),
      ).toHaveLength(banterLevel === 'none' ? 0 : 1);
      expect(
        container.querySelectorAll('[data-reaction-category^="domain-"]'),
      ).toHaveLength(banterLevel === 'full' ? 1 : 0);
      expect(
        container.querySelectorAll('[data-reaction-category^="score-"]'),
      ).toHaveLength(banterLevel === 'full' ? 1 : 0);
      if (banterLevel === 'none')
        expect(container.querySelectorAll('[data-reaction-id]')).toHaveLength(
          0,
        );
    },
  );

  it('reports recurring misses without claiming improvement from tiny historical samples', async () => {
    const user = userEvent.setup();
    const question = content.questions[0];
    const latest = { ...makeResult([question], []), id: 'latest-miss' };
    const previous = {
      ...makeResult([question], []),
      id: 'previous-miss',
      completedAt: '2026-09-10T16:10:00.000Z',
    };
    mount(game({ history: [latest, previous] }), '/tavern');
    expect(
      screen.getByText(
        'Not enough comparable, versioned runs to estimate improvement.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/percentage points/)).not.toBeInTheDocument();
    await user.click(screen.getByText('Recurring misses · 1 encounters'));
    expect(screen.getByText(/2 incorrect attempts/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Review saved encounter' }),
    ).toHaveAttribute('href', '/review/latest-miss');
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

  it.each(['start', 'retry', 'weak'] as const)(
    'wires a contextual %s session introduction only once',
    (practiceEvent) => {
      const value = game({
        active: session(),
        preferences: { ...defaultPreferences, banterLevel: 'full' },
      });
      const { container, rerender } = render(
        <GameContext.Provider value={value}>
          <MemoryRouter
            initialEntries={[{ pathname: '/play', state: { practiceEvent } }]}
          >
            <AppRoutes />
          </MemoryRouter>
        </GameContext.Provider>,
      );
      const category =
        practiceEvent === 'weak' ? 'weak-practice' : practiceEvent;
      const original = container.querySelector(
        `[data-reaction-category="${category}"]`,
      );
      expect(original).not.toBeNull();
      const id = original?.getAttribute('data-reaction-id');
      rerender(
        <GameContext.Provider value={{ ...value }}>
          <MemoryRouter
            initialEntries={[{ pathname: '/play', state: { practiceEvent } }]}
          >
            <AppRoutes />
          </MemoryRouter>
        </GameContext.Provider>,
      );
      expect(
        container.querySelector(`[data-reaction-category="${category}"]`),
      ).toHaveAttribute('data-reaction-id', id);
    },
  );

  it('keeps historical answers readable but cannot retry an unverified saved snapshot', async () => {
    const user = userEvent.setup();
    const historical = {
      ...content.questions[0],
      verificationStatus: 'stale' as const,
    };
    const result = makeResult([historical]);
    const value = game({ bank: [], history: [result] });
    mount(value, `/results/${result.id}`);
    expect(
      screen.getByRole('button', { name: /^Retry missed/ }),
    ).toBeDisabled();
    await user.click(screen.getByRole('link', { name: 'Review all answers' }));
    expect(screen.getByText(historical.question)).toBeVisible();
    expect(screen.getByText(historical.explanation)).toBeVisible();
    expect(value.startSession).not.toHaveBeenCalled();
  });
});
