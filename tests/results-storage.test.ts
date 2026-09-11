import { beforeEach, describe, expect, it } from 'vitest';
import { missedQuestions, scoreSession } from '../src/features/results/scoring';
import {
  addResult,
  clearData,
  freshData,
  loadData,
  saveData,
  STORAGE_KEY,
} from '../src/services/storage';
import { escapeHtml, resultHtml, resultJson } from '../src/services/export';
import { question, result, taxonomy } from './fixtures';

beforeEach(() => localStorage.clear());

describe('scoring and recommendations', () => {
  it('scores categories, exact sets, unanswered, timing, flags and streaks transparently', () => {
    const questions = [
      question('one'),
      question('two'),
      question('three', {
        skill: 'batch',
        objectiveDomain: 'ingest',
        subskill: 'Loading',
      }),
      question('four'),
    ];
    const session = result(questions, ['one', 'two']);
    session.responses = session.responses.slice(0, 3);
    session.responses[1].flagged = true;
    const score = scoreSession(session, taxonomy);
    expect(score).toMatchObject({
      correct: 2,
      incorrect: 1,
      unanswered: 1,
      percentage: 50,
      currentStreak: 0,
      bestStreak: 2,
      flagged: ['two'],
      averageTimeMs: 2000,
    });
    expect(score.byDomain.find((d) => d.id === 'manage')).toMatchObject({
      correct: 2,
      total: 3,
      insufficient: true,
    });
    expect(score.bySkill.find((d) => d.id === 'batch')).toMatchObject({
      correct: 0,
      total: 1,
    });
    expect(score.byDifficulty[0].total).toBe(4);
    expect(score.byComplexity[0].total).toBe(4);
    expect(score.bySubskill.find((s) => s.id === 'Loading')?.total).toBe(1);
    expect(score.mastery).toMatch(/Insufficient/);
    expect(score.weakest[0].id).toBe('batch');
    expect(score.recommendations[0].questions.map((q) => q.id)).toEqual([
      'three',
    ]);
    expect(missedQuestions(session).map((q) => q.id)).toEqual([
      'three',
      'four',
    ]);
  });
  it('does not invent weak topics or mastery from a perfect tiny sample', () => {
    const score = scoreSession(result([question()], ['q1']), taxonomy);
    expect(score.percentage).toBe(100);
    expect(score.recommendations).toEqual([]);
    expect(score.mastery).toMatch(/Insufficient/);
  });
});

describe('local persistence', () => {
  it('round-trips settings and historical question snapshots', () => {
    const data = addResult(freshData(), result());
    data.preferences.reducedBanter = true;
    data.config.timerMode = 'session';
    expect(saveData(localStorage, data)).toBeNull();
    expect(loadData(localStorage)).toEqual({ data, error: null });
    expect(clearData(localStorage)).toBeNull();
    expect(loadData(localStorage).data.history).toEqual([]);
  });
  it('clears only this app key and does not delete unrelated site data', () => {
    localStorage.setItem('unrelated', 'keep');
    saveData(localStorage, freshData());
    clearData(localStorage);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('surfaces malformed and future-version data without silently overwriting it', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadData(localStorage).error).toMatch(/could not be read/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{not json');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...freshData(), version: 99 }),
    );
    expect(loadData(localStorage).error).toMatch(/unsupported/);
  });
  it('rejects stored results with duplicate responses or unknown answer choices', () => {
    const data = addResult(freshData(), result());
    data.history[0].responses.push({ ...data.history[0].responses[0] });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    expect(loadData(localStorage).error).toMatch(/damaged/);
    data.history[0].responses.pop();
    data.history[0].responses[0].selectedAnswer = ['not-a-choice'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    expect(loadData(localStorage).error).toMatch(/damaged/);
  });
  it('surfaces unavailable and full storage, and propagates unrelated programming errors', () => {
    expect(
      saveData(
        {
          setItem() {
            throw new DOMException('Full', 'QuotaExceededError');
          },
        },
        freshData(),
      ),
    ).toMatch(/could not save/);
    expect(
      loadData({
        getItem() {
          throw new DOMException('Blocked', 'SecurityError');
        },
      }).error,
    ).toMatch(/could not be read/);
    expect(
      clearData({
        removeItem() {
          throw new DOMException('Blocked', 'SecurityError');
        },
      }),
    ).toMatch(/blocked/);
    expect(() =>
      loadData({
        getItem() {
          throw new Error('Programming bug');
        },
      }),
    ).toThrow('Programming bug');
  });
  it('retains the most recent 30 results and deduplicates completion events', () => {
    let data = freshData();
    for (let i = 0; i < 35; i++)
      data = addResult(data, { ...result(), id: `result-${i}` });
    expect(data.history).toHaveLength(30);
    expect(data.history[0].id).toBe('result-34');
    expect(
      addResult(data, { ...result(), id: 'result-34' }).history,
    ).toHaveLength(30);
  });
});

describe('safe exports', () => {
  it('exports structured JSON and printable HTML with citations and complete review', () => {
    const session = result();
    expect(JSON.parse(resultJson(session, taxonomy)).summary.correct).toBe(0);
    const html = resultHtml(session, taxonomy);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Your answer:');
    expect(html).toContain('Use your browser');
  });
  it('escapes user/content text and refuses non-Learn URLs', () => {
    expect(escapeHtml('<script>"&\'')).toBe('&lt;script&gt;&quot;&amp;&#39;');
    const session = result([
      question('injection', { question: '<img src=x onerror=alert(1)>' }),
    ]);
    expect(resultHtml(session, taxonomy)).not.toContain('<img');
    session.questions[0].sourceUrls = ['javascript:alert(1)'];
    expect(() => resultHtml(session, taxonomy)).toThrow();
  });
});
