import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  reactionCatalog,
  type ReactionCategory,
} from '../src/features/personality/catalog';
import {
  answerCategories,
  allowsReaction,
  domainCategory,
  readBanterLevel,
  ReactionSession,
  scoreCategory,
} from '../src/features/personality/reactions';
import {
  PersonalityContext,
  ReactionSessions,
} from '../src/features/personality/context';
import { HostReaction } from '../src/features/personality/HostReaction';
import { useReaction } from '../src/features/personality/useReaction';
import { isCorrect } from '../src/features/quiz/engine';
import { question } from './fixtures';

vi.mock('../src/features/quiz/context', () => ({
  useGame: () => ({ preferences: { banterLevel: 'full' } }),
}));

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe('original contextual reaction catalog', () => {
  it.each([
    ['correct', 30],
    ['incorrect', 30],
    ['streak', 15],
    ['time-expired', 15],
    ['session-complete', 20],
    ['documentation', 10],
    ['weak-practice', 10],
  ] as const)(
    'contains a sufficient general %s pool (%i minimum)',
    (category, minimum) => {
      expect(
        reactionCatalog.filter(
          (message) =>
            message.category === category && !message.applicableDomains.length,
        ).length,
      ).toBeGreaterThanOrEqual(minimum);
    },
  );

  it('has distinct IDs, complete metadata, and specific messages for all three domains', () => {
    expect(new Set(reactionCatalog.map((message) => message.id)).size).toBe(
      reactionCatalog.length,
    );
    expect(new Set(reactionCatalog.map((message) => message.text)).size).toBe(
      reactionCatalog.length,
    );
    for (const message of reactionCatalog) {
      expect(message.opening.length).toBeGreaterThan(0);
      expect(message.themes.length).toBeGreaterThan(0);
      expect(message.reducedBanterText.length).toBeGreaterThan(0);
      expect(message.intensity).toBeGreaterThanOrEqual(1);
      expect(message.tone).toBeTruthy();
    }
    for (const domain of [
      'implement-and-manage-an-analytics-solution',
      'ingest-and-transform-data',
      'monitor-and-optimize-an-analytics-solution',
    ]) {
      const session = new ReactionSession(reactionCatalog, {
        random: seeded(4),
      });
      const reaction = session.react(
        'answer',
        ['correct'],
        { domainId: domain, skill: 'A sampled skill' },
        'full',
        'answer',
      );
      expect(reaction?.applicableDomains).toContain(domain);
      expect(reaction?.renderedText).toContain('A sampled skill');
    }
  });
});

describe('finite, contextual, repeat-protected selection', () => {
  it('reproduces the same sequence from the same random seed', () => {
    const first = new ReactionSession(reactionCatalog, { random: seeded(902) });
    const second = new ReactionSession(reactionCatalog, {
      random: seeded(902),
    });
    const sequence = (session: ReactionSession) =>
      Array.from(
        { length: 60 },
        (_, index) =>
          session.react(String(index), ['correct'], {}, 'full', 'answer')?.id,
      );
    expect(sequence(first)).toEqual(sequence(second));
  });

  it('exhausts the configured portion before repeating IDs and avoids recent themes and openings', () => {
    const session = new ReactionSession(reactionCatalog, {
      random: seeded(44),
      exhaustProportion: 0.8,
      themeWindow: 2,
      openingWindow: 2,
    });
    const chosen = Array.from({ length: 100 }, (_, index) =>
      session.react(String(index), ['correct'], {}, 'full', 'answer')!,
    );
    for (let index = 1; index < chosen.length; index++) {
      expect(
        chosen
          .slice(Math.max(0, index - 24), index)
          .map((message) => message.id),
      ).not.toContain(chosen[index].id);
      expect(chosen[index].opening).not.toBe(chosen[index - 1].opening);
      expect(
        chosen[index].themes.some((theme) =>
          chosen[index - 1].themes.includes(theme),
        ),
      ).toBe(false);
    }
  });

  it('supports complete pool exhaustion, safe tiny pools, and empty fallback', () => {
    const messages = reactionCatalog.filter(
      (message) =>
        message.category === 'correct' && !message.applicableDomains.length,
    );
    const full = new ReactionSession(messages, {
      exhaustProportion: 1,
      random: seeded(1),
    });
    const initial = Array.from(
      { length: messages.length },
      (_, index) =>
        full.react(String(index), ['correct'], {}, 'full', 'answer')!.id,
    );
    expect(new Set(initial).size).toBe(messages.length);
    const tiny = new ReactionSession(messages.slice(0, 1));
    for (let index = 0; index < 30; index++)
      expect(
        tiny.react(
          String(index),
          ['expert-correct', 'correct'],
          {},
          'full',
          'answer',
        )?.id,
      ).toBe(messages[0].id);
    expect(
      new ReactionSession([]).react(
        'missing',
        ['correct'],
        {},
        'full',
        'answer',
      ),
    ).toBeNull();
  });

  it('prefers matching difficulty and streak bounds and renders variables', () => {
    const session = new ReactionSession(reactionCatalog, { random: seeded(1) });
    expect(
      session.react(
        'expert',
        ['expert-correct', 'correct'],
        { difficulty: 'expert' },
        'full',
        'answer',
      )?.category,
    ).toBe('expert-correct');
    expect(
      session.react(
        'ordinary',
        ['expert-correct', 'correct'],
        { difficulty: 'beginner' },
        'full',
        'answer',
      )?.category,
    ).toBe('correct');
    expect(
      session.react(
        'short',
        ['streak', 'correct'],
        { streak: 2 },
        'full',
        'answer',
      )?.category,
    ).toBe('correct');
    const streak = session.react(
      'streak',
      ['streak', 'correct'],
      { streak: 5 },
      'full',
      'answer',
    );
    expect(streak?.renderedText).toContain('5');
    expect(streak?.renderedText).not.toContain('{streak}');
    const bounded = new ReactionSession([
      { ...reactionCatalog[0], maximumStreak: 2 },
    ]);
    expect(
      bounded.react('large', ['correct'], { streak: 3 }, 'full', 'answer'),
    ).toBeNull();
  });

  it('does not consume repeated render events and resets between sessions', () => {
    const sessions = new ReactionSessions();
    const first = sessions.get('session-1');
    const initial = first.react('q1', ['correct'], {}, 'full', 'answer');
    expect(first.react('q1', ['correct'], {}, 'full', 'answer')).toEqual(
      initial,
    );
    expect(first.history).toHaveLength(1);
    expect(sessions.get('session-2').history).toHaveLength(0);
    first.reset();
    expect(first.history).toHaveLength(0);
  });

  it.each([
    [{ timedOut: true }, 'time-expired'],
    [{ selected: [] }, 'unanswered'],
    [{ correct: true }, 'correct'],
    [{ correct: true, difficulty: 'expert' }, 'expert-correct'],
    [{ difficulty: 'expert' }, 'expert-miss'],
    [{ correct: true, streak: 3 }, 'streak'],
    [{ previousStreak: 3 }, 'broken-streak'],
    [{ correct: true, recovered: true }, 'improved'],
    [{ correct: true, previousCorrect: false }, 'improved'],
    [{ previousCorrect: false }, 'repeated-mistake'],
    [{ correctAnswer: ['a', 'c'], selected: ['a'] }, 'partial'],
  ] satisfies Array<
    [Partial<Parameters<typeof answerCategories>[0]>, ReactionCategory]
  >)('selects the relevant answer event %#', (overrides, category) => {
    expect(
      answerCategories({
        correct: false,
        selected: ['b'],
        correctAnswer: ['a'],
        timedOut: false,
        difficulty: 'intermediate',
        streak: 0,
        previousStreak: 0,
        ...overrides,
      })[0],
    ).toBe(category);
  });

  it('does not change exact-match scoring for partially correct multi-select answers', () => {
    const sample = question('partial', {
      questionType: 'multi-select',
      correctAnswer: ['a', 'c'],
    });
    expect(isCorrect(sample, ['a'])).toBe(false);
    expect(isCorrect(sample, ['a', 'c'])).toBe(true);
    expect(
      answerCategories({
        correct: false,
        selected: ['a'],
        correctAnswer: sample.correctAnswer,
        timedOut: false,
        difficulty: 'expert',
        streak: 0,
        previousStreak: 0,
      })[0],
    ).toBe('partial');
  });

  it('uses domain and final score thresholds without implying broad mastery', () => {
    expect([100, 80, 60, 0].map(domainCategory)).toEqual([
      'domain-perfect',
      'domain-strong',
      'domain-weak',
      'domain-weak',
    ]);
    expect([100, 60, 0].map(scoreCategory)).toEqual([
      'score-high',
      'score-medium',
      'score-low',
    ]);
  });
});

describe('global banter levels', () => {
  it('safely reads old preference values without overriding an explicit level', () => {
    expect(readBanterLevel({ reducedBanter: true })).toBe('reduced');
    expect(readBanterLevel({ reducedBanter: false })).toBe('balanced');
    expect(readBanterLevel({ reducedBanter: true, banterLevel: 'none' })).toBe(
      'none',
    );
  });

  it.each([
    'correct',
    'incorrect',
    'partial',
    'unanswered',
    'time-expired',
    'streak',
    'broken-streak',
    'domain-perfect',
    'domain-strong',
    'domain-weak',
    'improved',
    'repeated-mistake',
    'session-complete',
    'score-high',
    'score-medium',
    'score-low',
    'expert-correct',
    'expert-miss',
    'documentation',
    'retry',
    'weak-practice',
    'returning',
    'start',
  ] satisfies ReactionCategory[])(
    'suppresses %s entirely under No Banter',
    (category) => {
      const session = new ReactionSession();
      expect(
        session.react(
          'event',
          [category],
          { difficulty: 'expert', streak: 5 },
          'none',
          'summary',
        ),
      ).toBeNull();
      expect(session.history).toHaveLength(0);
    },
  );

  it('limits Balanced to answers and summary, Reduced to occasional mild feedback', () => {
    expect(allowsReaction('balanced', 'context', {})).toBe(false);
    expect(allowsReaction('balanced', 'answer', {})).toBe(true);
    const session = new ReactionSession();
    for (let answerNumber = 1; answerNumber <= 8; answerNumber++) {
      const reaction = session.react(
        String(answerNumber),
        ['correct'],
        { answerNumber },
        'reduced',
        'answer',
      );
      if (answerNumber % 4 === 0)
        expect(reaction?.renderedText).toBe(reaction?.reducedBanterText);
      else expect(reaction).toBeNull();
    }
    expect(session.history).toHaveLength(2);
    expect(
      session.react('summary', ['session-complete'], {}, 'reduced', 'summary'),
    ).not.toBeNull();
    expect(
      session.react('source', ['documentation'], {}, 'reduced', 'context'),
    ).toBeNull();
  });

  it('does not select twice under StrictMode or when unrelated renders happen', () => {
    const sessions = new ReactionSessions();
    function Example({
      tick,
      scope = 'first',
    }: {
      tick: number;
      scope?: string;
    }) {
      const reaction = useReaction(scope, 'one-event', ['correct']);
      return (
        <>
          <span>{tick}</span>
          <HostReaction reaction={reaction} />
        </>
      );
    }
    const ui = (tick: number, scope?: string) => (
      <StrictMode>
        <PersonalityContext.Provider value={sessions}>
          <Example tick={tick} scope={scope} />
        </PersonalityContext.Provider>
      </StrictMode>
    );
    const { rerender, container } = render(ui(0));
    expect(sessions.get('first').history).toHaveLength(1);
    const original = container.querySelector('.banter')!.textContent;
    rerender(ui(1));
    expect(screen.getByText('1')).toBeVisible();
    expect(sessions.get('first').history).toHaveLength(1);
    expect(container.querySelector('.banter')).toHaveTextContent(original!);
    rerender(ui(2, 'second'));
    expect(sessions.get('second').history).toHaveLength(1);
  });

  it('protects the opening actually displayed in mild Reduced reactions', () => {
    const session = new ReactionSession(reactionCatalog, {
      random: seeded(13),
    });
    let previous = '';
    for (let answerNumber = 4; answerNumber <= 80; answerNumber += 4) {
      const reaction = session.react(
        String(answerNumber),
        ['correct'],
        { answerNumber },
        'reduced',
        'answer',
      )!;
      expect(reaction.opening).toBe(
        reaction.renderedText.split(/[\s.,!?—:]+/)[0].toLowerCase(),
      );
      expect(reaction.opening).not.toBe(previous);
      previous = reaction.opening;
    }
  });
});
