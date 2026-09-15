import { afterEach, describe, expect, it, vi } from 'vitest';
import * as digest from '../src/features/dungeons/fingerprint';
import {
  objectiveFingerprint,
  questionFingerprint,
} from '../src/features/dungeons/review';
import { question, taxonomy } from './fixtures';

afterEach(() => vi.restoreAllMocks());

describe('exact-content fingerprint reuse', () => {
  it('hashes identical authored content once across parsed copies', () => {
    const source = question('cache-identical-content');
    const spy = vi.spyOn(digest, 'sha256');
    const expected = questionFingerprint(source);
    expect(questionFingerprint(structuredClone(source))).toBe(expected);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not reuse an object-identity result after an authored mutation', () => {
    const source = question('cache-authored-mutation');
    const original = questionFingerprint(source);
    source.answerChoices[0].text = 'Changed authored answer';
    expect(questionFingerprint(source)).not.toBe(original);
    source.answerChoices[0].text = 'A suitable option';
    expect(questionFingerprint(source)).toBe(original);
  });

  it('excludes review metadata without caching an approval decision', () => {
    const source = question('cache-review-metadata');
    const original = questionFingerprint(source);
    source.verificationStatus = 'rejected';
    source.requiresManualReview = true;
    source.verificationNotes = 'A different review rejected this snapshot.';
    expect(questionFingerprint(source)).toBe(original);
    source.sourceUrls[0] =
      'https://learn.microsoft.com/en-us/fabric/new-source';
    expect(questionFingerprint(source)).not.toBe(original);
  });

  it('binds changed objective contents even when the version is unchanged', () => {
    const source = structuredClone(taxonomy);
    source.studyGuideEffectiveDate = 'Synthetic cache-map edition';
    const spy = vi.spyOn(digest, 'sha256');
    const original = objectiveFingerprint(source);
    expect(objectiveFingerprint(structuredClone(source))).toBe(original);
    expect(spy).toHaveBeenCalledTimes(1);
    source.domains[0].skills[0].subskills.push('A new objective');
    expect(objectiveFingerprint(source)).not.toBe(original);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('evicts old content instead of retaining an unbounded set of digests', () => {
    const source = question('cache-eviction-original');
    const original = questionFingerprint(source);
    for (let index = 0; index < 2050; index++)
      questionFingerprint(question(`cache-eviction-${index}`));
    const spy = vi.spyOn(digest, 'sha256');
    expect(questionFingerprint(source)).toBe(original);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not retain payloads larger than the cache budget', () => {
    const source = question('cache-oversized-content', {
      question: 'x'.repeat(2 * 1024 * 1024 + 1),
    });
    const spy = vi.spyOn(digest, 'sha256');
    const expected = questionFingerprint(source);
    expect(questionFingerprint(source)).toBe(expected);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
