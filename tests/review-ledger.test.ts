import { describe, expect, it } from 'vitest';
import { reviewLedgerFindings } from '../scripts/review-ledger';
import { dungeonFixture } from './dungeon-fixtures';

describe('consolidated independent-review ledger', () => {
  it('accepts exact copies of independently authored package reviews', () => {
    const ledger = dungeonFixture().raw.reviews;
    expect(
      reviewLedgerFindings(ledger.reviews, structuredClone(ledger)),
    ).toEqual([]);
  });

  it.each(['verified', 'manual-review-required', 'rejected', 'stale'] as const)(
    'requires an existing attestation for %s records, not just playable records',
    (verdict) => {
      const ledger = dungeonFixture().raw.reviews;
      ledger.reviews[0].verdict = verdict;
      expect(
        reviewLedgerFindings(ledger.reviews, { ...ledger, reviews: [] }),
      ).toEqual([expect.stringContaining('missing independent review')]);
    },
  );

  it('rejects changed reasoning even when the question fingerprint is unchanged', () => {
    const ledger = dungeonFixture().raw.reviews;
    const changed = structuredClone(ledger);
    changed.reviews[0].choiceReviews[0].rationale =
      'A different independent judgment must not silently replace this record.';
    expect(reviewLedgerFindings(ledger.reviews, changed)).toEqual([
      expect.stringContaining(
        'differs from the independently authored package review',
      ),
    ]);
  });

  it('rejects duplicate and orphaned review IDs', () => {
    const ledger = dungeonFixture().raw.reviews;
    expect(
      reviewLedgerFindings(ledger.reviews, {
        ...ledger,
        reviews: [...ledger.reviews, ...ledger.reviews],
      }),
    ).toEqual([expect.stringContaining('duplicate review')]);
    expect(reviewLedgerFindings([], ledger)).toEqual([
      expect.stringContaining('no installed package candidate'),
    ]);
  });

  it('allows other packages in an exam-scoped comparison without ignoring duplicate IDs', () => {
    const ledger = dungeonFixture().raw.reviews;
    const other = {
      ...structuredClone(ledger.reviews[0]),
      questionId: 'other-dungeon-question',
    };
    const combined = { ...ledger, reviews: [...ledger.reviews, other] };
    expect(reviewLedgerFindings(ledger.reviews, combined, true)).toEqual([]);
    combined.reviews.push(other);
    expect(reviewLedgerFindings(ledger.reviews, combined, true)).toEqual([
      expect.stringContaining('duplicate review'),
    ]);
  });
});
