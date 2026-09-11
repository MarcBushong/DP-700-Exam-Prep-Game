import { describe, expect, it } from 'vitest';
import {
  credentials,
  heroClasses,
  filterCredentials,
  validateCatalog,
} from '../src/features/dungeons/catalog';
import { credentialSchema } from '../src/features/dungeons/schema';
import { dungeonFixture } from './dungeon-fixtures';

describe('data-driven credential and hero-class catalog', () => {
  it('represents all requested identifiers without treating catalog membership as active verification', () => {
    expect(credentials).toHaveLength(18);
    expect(new Set(credentials.map((entry) => entry.credentialId)).size).toBe(
      18,
    );
    expect(heroClasses).toHaveLength(13);
    expect(validateCatalog(credentials, heroClasses)).toEqual([]);
    for (const credential of credentials) {
      expect(credential.disclaimer).toMatch(/unofficial/i);
      if (!credential.isVerified) {
        expect(credential.sealedReason).toBeTruthy();
        expect(['ready', 'limited']).not.toContain(credential.contentReadiness);
        expect(credential.verifiedQuestionCount).toBe(0);
      }
    }
  });
  it('retains evidenced active provider status while sealing an unverified current objective map', () => {
    const { credential } = dungeonFixture();
    const pending = {
      ...credential,
      isVerified: false,
      objectiveVersion: null,
      contentReadiness: 'unavailable',
      sealedReason:
        'Synthetic active registration evidence; the current objective map remains unverified.',
    };
    const classes = [
      {
        id: 'fixture-class',
        name: 'Generic test class',
        description: 'Test-only class.',
        credentialIds: [credential.credentialId],
      },
    ];
    expect(validateCatalog([pending], classes)).toEqual([]);
    expect(
      validateCatalog([{ ...pending, verificationEvidence: [] }], classes).join(
        ' ',
      ),
    ).toMatch(/active provider status requires/i);
    expect(
      validateCatalog(
        [{ ...pending, verifiedQuestionCount: 25 }],
        classes,
      ).join(' '),
    ).toMatch(/sealed/i);
  });
  it('uses generic many-to-many classes as filters, never required credential bundles', () => {
    const data = filterCredentials(credentials, {
      heroClassId: 'data-engineer',
    });
    expect(data.map((entry) => entry.credentialId)).toEqual(
      expect.arrayContaining(['dp-700', 'dp-420', 'dp-800']),
    );
    expect(
      filterCredentials(credentials, { heroClassId: 'wanderer' }).every(
        (entry) => entry.isVerified && entry.status === 'active',
      ),
    ).toBe(true);
    expect(
      filterCredentials(credentials, { heroClassId: 'unknown-class' }),
    ).toEqual([]);
    expect(
      filterCredentials(credentials, { query: ' dp-700 ' }).map(
        (entry) => entry.credentialId,
      ),
    ).toEqual(['dp-700']);
    expect(
      filterCredentials(credentials, { query: 'fabric' }).some(
        (entry) => entry.credentialId === 'dp-700',
      ),
    ).toBe(true);
    expect(
      filterCredentials(credentials, { productArea: 'Nonexistent area' }),
    ).toEqual([]);
  });
  it('rejects duplicate IDs, unknown mappings and unverified active claims', () => {
    const { credential } = dungeonFixture();
    const classes = [
      {
        id: 'fixture-class',
        name: 'Generic test class',
        description: 'Test-only class.',
        credentialIds: [credential.credentialId],
      },
    ];
    expect(validateCatalog([credential], classes)).toEqual([]);
    expect(
      validateCatalog([credential, credential], classes).join(' '),
    ).toMatch(/unique/i);
    expect(
      validateCatalog(
        [credential],
        [{ ...classes[0], credentialIds: ['unknown'] }],
      ).join(' '),
    ).toMatch(/unknown credential/i);
    expect(
      validateCatalog([{ ...credential, isVerified: false }], classes).join(
        ' ',
      ),
    ).toMatch(/sealed/i);
    expect(
      validateCatalog(
        [{ ...credential, verificationEvidence: [] }],
        classes,
      ).join(' '),
    ).toMatch(/evidence/i);
    expect(
      credentialSchema.safeParse({ ...credential, credentialId: '..\\escape' })
        .success,
    ).toBe(false);
  });
});
