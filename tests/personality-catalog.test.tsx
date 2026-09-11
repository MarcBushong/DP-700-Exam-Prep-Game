import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import shared from '../src/content/personality.json';
import {
  mergeCatalog,
  parseCatalog,
  personalityThemes,
  reactionCatalog,
  reactionCategories,
  validateStarterCatalog,
  type BanterLevel,
} from '../src/features/personality/catalog';
import {
  answerCategories,
  ReactionSession,
  type ReactionContext,
} from '../src/features/personality/reactions';
import { ReactionSessions } from '../src/features/personality/context';
import { PersonalityProvider } from '../src/features/personality/PersonalityProvider';
import { DocumentationReactions } from '../src/features/personality/DocumentationReactions';
import { HostReaction } from '../src/features/personality/HostReaction';
import { useReaction } from '../src/features/personality/useReaction';

const preferences = vi.hoisted(() => ({ banterLevel: 'full' as BanterLevel }));
vi.mock('../src/features/quiz/context', () => ({
  useGame: () => ({ preferences }),
}));

const credentialIds = [
  'dp-700',
  'az-104',
  'az-120',
  'az-305',
  'az-700',
  'az-800',
  'dp-420',
  'dp-800',
  'ai-103',
  'ai-200',
  'ai-300',
  'ai-901',
  'sc-200',
  'sc-500',
  'az-400',
  'github-agentic-ai-developer',
  'github-copilot',
  'github-advanced-security',
];
const extension = (credentialId: string) =>
  JSON.parse(
    readFileSync(
      join('src', 'content', 'exams', credentialId, 'personality.json'),
      'utf8',
    ),
  ) as unknown;

beforeEach(() => {
  preferences.banterLevel = 'full';
});

describe('versioned personality documents', () => {
  it('validates the real starter bank, all categories, and all technical themes', () => {
    const report = validateStarterCatalog(shared);
    expect(report.total).toBeGreaterThan(196);
    expect(Object.keys(report.categories)).toHaveLength(
      reactionCategories.length,
    );
    expect(Object.keys(report.themes)).toEqual(
      expect.arrayContaining([...personalityThemes]),
    );
    for (const category of [
      'correct',
      'incorrect',
      'streak',
      'time-expired',
      'session-complete',
    ]) {
      expect(
        new Set(
          reactionCatalog
            .filter((line) => line.category === category)
            .map((line) => line.themes[0]),
        ).size,
      ).toBeGreaterThanOrEqual(12);
    }
    for (const line of reactionCatalog) {
      expect(line.text.length).toBeLessThanOrEqual(220);
      expect(line.text).not.toMatch(/placeholder|lorem ipsum|reaction \d+/i);
      expect(line.reducedBanterText).not.toMatch(
        /\b(?:idiot|stupid|failure|loser)\b/i,
      );
    }
  });

  it.each([
    { category: 'fabric-fact' },
    { id: '' },
    { tone: 'hostile' },
    { intensity: 4 },
    { applicableDungeons: undefined },
    { applicableDifficulties: ['legendary'] },
    { themes: [] },
    { themes: ['data', 'data'] },
    { minStreak: 4, maxStreak: 2 },
    { minTimeMs: 10, maxTimeMs: 1 },
    { text: '<strong>Scenery</strong>' },
    { text: 'See https://example.com for the answer.' },
    { text: 'Run `DELETE` now.' },
    { text: '{answer} is correct.' },
    { text: 'Broken {dungeon' },
    { sourceIds: ['not-a-flavor-field'] },
  ])('rejects malformed or fact-bearing metadata %#', (overrides) => {
    expect(() =>
      parseCatalog({
        version: 2,
        messages: [{ ...shared.messages[0], ...overrides }],
      }),
    ).toThrow();
  });

  it('rejects ID collisions, repeated text, unsupported versions, and insufficient real pools', () => {
    expect(() => mergeCatalog(shared, [shared])).toThrow(
      /Duplicate personality ID/,
    );
    const duplicateText = { ...shared.messages[0], id: 'extension.duplicate' };
    expect(() =>
      mergeCatalog(shared, [{ version: 2, messages: [duplicateText] }]),
    ).toThrow(/Duplicate personality text/);
    expect(() => parseCatalog({ version: 1, messages: [] })).toThrow();
    expect(() =>
      validateStarterCatalog({
        version: 2,
        messages: shared.messages.slice(0, 2),
      }),
    ).toThrow(/shared lines/);
    expect(parseCatalog(reactionCatalog)).toEqual(reactionCatalog);
    expect(parseCatalog({ version: 2, messages: [] })).toEqual([]);
  });

  it.each(credentialIds)(
    'has complete, scoped boss artwork for %s without unlocking anything',
    (credentialId) => {
      const catalog = parseCatalog(extension(credentialId));
      expect(catalog.map((line) => line.category)).toEqual(
        expect.arrayContaining(['boss-intro', 'boss-defeat']),
      );
      for (const line of catalog) {
        expect(line.applicableDungeons).toEqual([credentialId]);
        expect(line.text).not.toMatch(
          /dungeon (?:is )?(?:open|ready|unlocked)|guaranteed pass|official practice exam/i,
        );
        expect(line).not.toHaveProperty('status');
        expect(line).not.toHaveProperty('contentReadiness');
      }
    },
  );

  it('merges every extension without copying an engine or overriding shared content', () => {
    const catalog = mergeCatalog(shared, credentialIds.map(extension));
    expect(catalog).toHaveLength(
      reactionCatalog.length + credentialIds.length * 2,
    );
    expect(new Set(catalog.map((line) => line.id)).size).toBe(catalog.length);
    expect(reactionCatalog).toHaveLength(shared.messages.length);
  });
});

describe('dungeon-aware context with safe fallback', () => {
  it.each(personalityThemes)(
    'prefers %s subject flavor when no repetition restriction applies',
    (theme) => {
      const session = new ReactionSession(reactionCatalog, { seed: 16 });
      expect(
        session.react(
          'first',
          ['correct'],
          { subjectTheme: theme },
          'full',
          'answer',
        )?.themes,
      ).toContain(theme);
    },
  );

  it('normalizes public theme labels and still avoids repeating the topic', () => {
    const session = new ReactionSession(reactionCatalog, { seed: 12 });
    const first = session.react(
      'one',
      ['correct'],
      { subjectTheme: 'GitHub Copilot' },
      'full',
      'answer',
    )!;
    const next = session.react(
      'two',
      ['correct'],
      { subjectTheme: 'GitHub Copilot' },
      'full',
      'answer',
    )!;
    expect(first.themes).toContain('github-copilot');
    expect(next.themes).not.toContain('github-copilot');
    expect(next.opening).not.toBe(first.opening);
  });

  it('hard-filters other dungeon extensions and falls back for unknown or absent credentials', () => {
    const catalog = mergeCatalog(shared, credentialIds.map(extension));
    for (const credentialId of credentialIds) {
      const session = new ReactionSession(catalog, { seed: 9 });
      expect(
        session.react(
          'boss',
          ['boss-intro'],
          { credentialId, boss: true },
          'full',
          'context',
        )?.applicableDungeons,
      ).toEqual([credentialId]);
    }
    for (const credentialId of ['future-dungeon', undefined]) {
      const session = new ReactionSession(catalog, { seed: 9 });
      expect(
        session.react(
          'boss',
          ['boss-intro'],
          { credentialId },
          'full',
          'context',
        )?.applicableDungeons,
      ).toEqual([]);
    }
    const unrelated = new ReactionSession(parseCatalog(extension('dp-700')));
    expect(
      unrelated.react(
        'no-leak',
        ['boss-intro'],
        { credentialId: 'az-104' },
        'full',
        'context',
      ),
    ).toBeNull();
  });

  it('scopes event cache IDs by actual credential while preserving idempotence', () => {
    const random = vi.fn(() => 0.25);
    const session = new ReactionSession(
      mergeCatalog(shared, [extension('dp-700'), extension('az-104')]),
      { random },
    );
    const one = session.react(
      'same-question-id',
      ['boss-intro'],
      { credentialId: 'dp-700' },
      'full',
      'context',
    );
    expect(
      session.react(
        'same-question-id',
        ['boss-intro'],
        { credentialId: 'dp-700' },
        'full',
        'context',
      ),
    ).toEqual(one);
    const other = session.react(
      'same-question-id',
      ['boss-intro'],
      { credentialId: 'az-104' },
      'full',
      'context',
    );
    expect(one?.id).not.toBe(other?.id);
    expect(other?.applicableDungeons).toEqual(['az-104']);
    expect(session.history).toHaveLength(2);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('matches floor and objective IDs, difficulty, response time, streak, recovery, and boss constraints', () => {
    const raw = {
      ...shared.messages[0],
      applicableDungeons: ['test-dungeon'],
      applicableDomains: ['floor-id'],
      applicableObjectives: ['objective-id'],
      applicableDifficulties: ['expert'],
      minStreak: 3,
      maxStreak: 5,
      minTimeMs: 10000,
      maxTimeMs: 90000,
      recovered: true,
      boss: true,
      text: 'Look at {dungeon}, {floor}, {objective}, {skill}, {difficulty}, streak {streak}.',
    };
    const catalog = parseCatalog([raw]);
    const context: ReactionContext = {
      credentialId: 'test-dungeon',
      dungeon: 'Practice Keep',
      floorId: 'floor-id',
      floor: 'Scenario floor',
      objectiveId: 'objective-id',
      objective: 'Scenario objective',
      skill: 'Tradeoffs',
      difficulty: 'expert',
      streak: 4,
      timeMs: 60000,
      recovered: true,
      boss: true,
    };
    expect(
      new ReactionSession(catalog).react(
        'all',
        ['correct'],
        context,
        'full',
        'answer',
      )?.renderedText,
    ).toBe(
      'Look at Practice Keep, Scenario floor, Scenario objective, Tradeoffs, expert, streak 4.',
    );
    for (const mismatch of [
      { credentialId: 'elsewhere' },
      { floorId: 'elsewhere' },
      { objectiveId: 'elsewhere' },
      { difficulty: 'beginner' },
      { streak: 2 },
      { streak: 6 },
      { timeMs: 9999 },
      { timeMs: 90001 },
      { timeMs: undefined },
      { timeMs: Number.NaN },
      { recovered: false },
      { boss: false },
    ]) {
      expect(
        new ReactionSession(catalog).react(
          'mismatch',
          ['correct'],
          { ...context, ...mismatch },
          'full',
          'answer',
        ),
      ).toBeNull();
    }
  });

  it('uses actual time context without assuming fast means correct or slow means weak', () => {
    for (const [timeMs, expected] of [
      [10000, 'expert-correct.swift-quill'],
      [70000, 'expert-correct.unhurried-strike'],
    ] as const) {
      expect(
        new ReactionSession(reactionCatalog, { seed: 4 }).react(
          'answer',
          ['expert-correct'],
          { timeMs, difficulty: 'expert' },
          'full',
          'answer',
        )?.id,
      ).toBe(expected);
    }
    expect(
      new ReactionSession(reactionCatalog).react(
        'missing-time',
        ['expert-correct'],
        { difficulty: 'expert' },
        'full',
        'answer',
      )?.minTimeMs,
    ).toBeUndefined();
  });

  it('uses boss categories only when the caller says this is a boss, without changing partial scoring', () => {
    const input = {
      correct: true,
      selected: ['a'],
      correctAnswer: ['a'],
      timedOut: false,
      difficulty: 'expert',
      streak: 4,
      previousStreak: 3,
    };
    expect(answerCategories({ ...input, boss: true })[0]).toBe('boss-defeat');
    expect(answerCategories({ ...input, boss: true, correct: false })[0]).toBe(
      'boss-loss',
    );
    expect(answerCategories({ ...input, boss: true, timedOut: true })[0]).toBe(
      'time-expired',
    );
    expect(answerCategories(input)[0]).toBe('expert-correct');
  });

  it('reproduces seeded contextual sequences across mixed-dungeon events', () => {
    const catalog = mergeCatalog(shared, credentialIds.map(extension));
    const sequence = (session: ReactionSession) =>
      Array.from(
        { length: 80 },
        (_, index) =>
          session.react(
            String(index),
            index % 2 ? ['correct'] : ['boss-intro'],
            {
              credentialId: credentialIds[index % credentialIds.length],
              subjectTheme: personalityThemes[index % personalityThemes.length],
              boss: index % 2 === 0,
              streak: index % 5,
            },
            'full',
            'answer',
          )?.id,
      );
    expect(sequence(new ReactionSession(catalog, { seed: 900 }))).toEqual(
      sequence(new ReactionSession(catalog, { seed: 900 })),
    );
  });

  it.each(['full', 'reduced'] as const)(
    'protects actual openings and joke motifs in %s over a long run',
    (level) => {
      const session = new ReactionSession(reactionCatalog, {
        seed: 115,
        exhaustProportion: 0.8,
      });
      const chosen = Array.from({ length: 120 }, (_, index) =>
        session.react(
          String(index),
          ['correct'],
          { answerNumber: (index + 1) * 4 },
          level,
          'answer',
        )!,
      );
      for (let index = 1; index < chosen.length; index++) {
        expect(chosen[index].opening).not.toBe(chosen[index - 1].opening);
        expect(
          chosen[index].jokeThemes?.some((theme) =>
            chosen[index - 1].jokeThemes?.includes(theme),
          ),
        ).toBe(false);
        expect(
          chosen.slice(Math.max(0, index - 26), index).map((line) => line.id),
        ).not.toContain(chosen[index].id);
      }
    },
  );

  it('does not let other dungeons spend the eligible pool exhaustion window', () => {
    const catalog = parseCatalog([
      {
        ...shared.messages[0],
        id: 'first.one',
        applicableDungeons: ['first'],
        text: 'First dragon bows.',
      },
      {
        ...shared.messages[1],
        id: 'first.two',
        applicableDungeons: ['first'],
        text: 'Second herald nods.',
      },
      {
        ...shared.messages[2],
        id: 'other.one',
        applicableDungeons: ['other'],
        text: 'Other chamber cheers.',
      },
      {
        ...shared.messages[3],
        id: 'other.two',
        applicableDungeons: ['other'],
        text: 'Another room applauds.',
      },
    ]);
    const session = new ReactionSession(catalog, {
      seed: 14,
      exhaustProportion: 1,
    });
    const first = session.react(
      'first',
      ['correct'],
      { credentialId: 'first' },
      'full',
      'answer',
    )!;
    for (let index = 0; index < 10; index++)
      session.react(
        String(index),
        ['correct'],
        { credentialId: 'other' },
        'full',
        'answer',
      );
    const next = session.react(
      'next',
      ['correct'],
      { credentialId: 'first' },
      'full',
      'answer',
    )!;
    expect(next.id).not.toBe(first.id);
  });

  it('isolates scopes and accepts a new validated catalog identity without leaking old cached messages', () => {
    const one = parseCatalog(extension('dp-700'));
    const two = parseCatalog(extension('az-104'));
    const sessions = new ReactionSessions(one, { seed: 5 });
    const first = sessions.get('run');
    first.react(
      'boss',
      ['boss-intro'],
      { credentialId: 'dp-700' },
      'full',
      'context',
    );
    expect(sessions.get('run')).toBe(first);
    expect(sessions.get('another-run').history).toHaveLength(0);
    const replacement = sessions.get('run', two);
    expect(replacement).not.toBe(first);
    expect(replacement.history).toHaveLength(0);
    expect(sessions.get('run', two)).toBe(replacement);
  });
});

describe('settings, accessibility, and effect-only selection', () => {
  it('blocks every gauntlet reaction until the debrief is explicitly identified', () => {
    const random = vi.fn(() => 0.3);
    const session = new ReactionSession(reactionCatalog, { random });
    for (const category of reactionCategories) {
      for (const surface of ['answer', 'context', 'summary'] as const) {
        for (const inProgress of [undefined, true]) {
          expect(
            session.react(
              `${category}:${surface}:${inProgress}`,
              [category],
              {
                runMode: 'gauntlet',
                inProgress,
                streak: 4,
                difficulty: 'expert',
                answerNumber: 4,
                boss: true,
              },
              'full',
              surface,
            ),
          ).toBeNull();
        }
      }
    }
    expect(session.history).toHaveLength(0);
    expect(random).not.toHaveBeenCalled();
    expect(
      session.react(
        'debrief',
        ['session-complete'],
        { runMode: 'gauntlet', inProgress: false },
        'full',
        'summary',
      ),
    ).not.toBeNull();
    expect(random).toHaveBeenCalledTimes(1);
  });

  function Probe({ eventId = 'answer' }: { eventId?: string }) {
    const reaction = useReaction(
      'scope',
      eventId,
      ['correct'],
      { answerNumber: 4 },
      'answer',
    );
    return (
      <>
        <p role="status">Correct answer. Technical explanation.</p>
        <HostReaction reaction={reaction} />
      </>
    );
  }

  it('does not use randomness during server render and consumes once after StrictMode effects', () => {
    const random = vi.fn(() => 0.4);
    const options = { random };
    const ui = (
      <StrictMode>
        <PersonalityProvider options={options}>
          <Probe />
        </PersonalityProvider>
      </StrictMode>
    );
    expect(renderToString(ui)).toContain('Technical explanation.');
    expect(random).not.toHaveBeenCalled();
    const { container, rerender } = render(ui);
    expect(random).toHaveBeenCalledTimes(1);
    const text = container.querySelector('.banter')?.textContent;
    rerender(ui);
    expect(random).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.banter')?.textContent).toBe(text);
    const status = screen.getByRole('status');
    expect(status).not.toContainElement(container.querySelector('.banter'));
    expect(status.nextElementSibling).toHaveAttribute('aria-live', 'off');
    expect(status.nextElementSibling).toHaveAttribute(
      'data-personality',
      'flavor',
    );
  });

  it('applies Silent immediately, then returns mild text without consuming the event twice', () => {
    const random = vi.fn(() => 0.2);
    const options = { random };
    const ui = () => (
      <PersonalityProvider options={options}>
        <Probe />
      </PersonalityProvider>
    );
    const { container, rerender } = render(ui());
    const id = container
      .querySelector('.banter')!
      .getAttribute('data-reaction-id');
    preferences.banterLevel = 'none';
    rerender(ui());
    expect(container.querySelector('.banter')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Technical explanation.',
    );
    preferences.banterLevel = 'reduced';
    rerender(ui());
    expect(container.querySelector('.banter')).toHaveTextContent(
      reactionCatalog.find((line) => line.id === id)!.reducedBanterText,
    );
    expect(random).toHaveBeenCalledTimes(1);
  });

  it.each(['none', 'balanced', 'reduced'] as const)(
    'suppresses every optional context category under %s',
    (level) => {
      const session = new ReactionSession();
      for (const category of reactionCategories) {
        expect(
          session.react(
            category,
            [category],
            { streak: 4, difficulty: 'expert', boss: true },
            level,
            'context',
          ),
        ).toBeNull();
      }
      expect(session.history).toHaveLength(0);
    },
  );

  it('keeps Reduced mild and sparse even for new boss and floor surfaces', () => {
    const session = new ReactionSession();
    expect(
      session.react(
        'boss-one',
        ['boss-defeat'],
        { answerNumber: 1 },
        'reduced',
        'answer',
      ),
    ).toBeNull();
    const fourth = session.react(
      'boss-four',
      ['boss-defeat'],
      { answerNumber: 4 },
      'reduced',
      'answer',
    )!;
    expect(fourth.intensity).toBe(1);
    expect(fourth.tone).toBe('warm');
    expect(fourth.renderedText).toBe(fourth.reducedBanterText);
    expect(
      session.react('floor', ['floor-cleared'], {}, 'none', 'summary'),
    ).toBeNull();
  });

  it('protects the displayed opening after changing the variant of a cached event', () => {
    const session = new ReactionSession(reactionCatalog, { seed: 7 });
    const full = session.react(
      'same',
      ['correct'],
      { answerNumber: 4 },
      'full',
      'answer',
    )!;
    const reduced = session.react(
      'same',
      ['correct'],
      { answerNumber: 4 },
      'reduced',
      'answer',
    )!;
    expect(reduced.id).toBe(full.id);
    expect(session.history).toHaveLength(1);
    expect(session.history[0].opening).toBe(reduced.opening);
    expect(
      session.react(
        'next',
        ['correct'],
        { answerNumber: 8 },
        'reduced',
        'answer',
      )?.opening,
    ).not.toBe(reduced.opening);
  });

  it('passes actual documentation context and does not turn repeated link clicks into repeated selections', () => {
    const random = vi.fn(() => 0);
    const raw = {
      ...shared.messages[0],
      id: 'test.tome',
      category: 'tome-opened',
      applicableDungeons: ['test-dungeon'],
      text: 'Notes for {floor}.',
    };
    const extensions = [{ version: 2, messages: [raw] }];
    const options = { random };
    render(
      <PersonalityProvider extensions={extensions} options={options}>
        <DocumentationReactions
          scope="docs"
          context={{ credentialId: 'test-dungeon', floor: 'Test floor' }}
        >
          <a
            className="learn-link"
            href="https://learn.microsoft.com/training/"
            onClick={(event) => event.preventDefault()}
          >
            Official source
          </a>
        </DocumentationReactions>
      </PersonalityProvider>,
    );
    const link = screen.getByRole('link', { name: 'Official source' });
    fireEvent.click(link);
    expect(screen.getByText('Notes for Test floor.')).toHaveAttribute(
      'aria-live',
      'off',
    );
    fireEvent.click(link);
    expect(random).toHaveBeenCalledTimes(1);
  });
});
