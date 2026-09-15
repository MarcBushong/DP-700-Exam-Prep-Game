import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { BetaAvailabilityNotice } from '../src/components/BetaAvailabilityNotice';
import {
  credentials,
  heroClasses,
  validateCatalog,
} from '../src/features/dungeons/catalog';
import { getDungeonPackage } from '../src/features/dungeons/packages';
import {
  buildContentStats,
  getDungeonReadiness,
} from '../src/features/dungeons/readiness';
import { GameProvider } from '../src/features/quiz/GameProvider';
import { useGame } from '../src/features/quiz/context';
import {
  dungeonAccess,
  planDungeonSession,
} from '../src/features/quiz/dungeonRuntime';
import { defaultConfig, type QuizConfig } from '../src/features/quiz/types';
import {
  addResult,
  freshData,
  loadData,
  saveData,
} from '../src/services/storage';
import { result } from './fixtures';

const betaId = 'github-agentic-ai-developer';
const beta = credentials.find((entry) => entry.credentialId === betaId)!;
const packageSnapshot = getDungeonPackage(betaId)!;
const modes = [
  { runMode: 'study', answerMode: 'immediate' },
  { runMode: 'gauntlet', answerMode: 'exam' },
  { runMode: 'study', answerMode: 'exam' },
  {
    credentialId: 'dp-700',
    runMode: 'raid',
    answerMode: 'immediate',
    raidCredentialIds: ['dp-700', betaId],
  },
] satisfies Partial<QuizConfig>[];

beforeEach(() => {
  localStorage.clear();
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

afterEach(() => vi.unstubAllGlobals());

function importSettings(mode: Partial<QuizConfig>) {
  const data = addResult(freshData(), result());
  data.selectedCredentialId = mode.credentialId ?? betaId;
  data.config = {
    ...defaultConfig,
    credentialId: betaId,
    ...mode,
  };
  expect(saveData(localStorage, data)).toBeNull();
  return loadData(localStorage).data;
}

function mountPage(path: string) {
  return render(
    <GameProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </GameProvider>,
  );
}

function Commands() {
  const game = useGame();
  return (
    <>
      <p>Active: {game.active?.id ?? 'none'}</p>
      <p>Selected: {game.selectedCredentialId}</p>
      <p>Bank: {game.bank.length}</p>
      <p>Notices: {game.notices.join(' ')}</p>
      <button onClick={() => game.selectDungeon(betaId)}>Select beta</button>
      <button onClick={() => game.startSession(game.config)}>
        Start imported configuration
      </button>
    </>
  );
}

describe('grounded GH-600 beta study access', () => {
  it('explicitly enables study access without changing beta identity evidence', () => {
    expect(beta).toMatchObject({
      examCode: 'GH-600',
      currentName: 'GitHub Certified: Agentic AI Developer',
      status: 'beta',
      isVerified: true,
      allowBetaPlay: true,
      contentReadiness: 'ready',
      verifiedQuestionCount: 136,
      minimumPlayableQuestionCount: 25,
    });
    expect(beta.sealedReason).toBeUndefined();
    expect(
      credentials
        .filter((entry) => entry.allowBetaPlay)
        .map((entry) => entry.credentialId),
    ).toEqual([betaId]);
    const api = beta.verificationEvidence
      .filter(
        (entry) =>
          entry.url === 'https://learn.github.com/api/certifications/AGENTIC',
      )
      .at(-1)!;
    expect(api.retrievedAt).toBe('2026-09-14T17:48:35.099Z');
    expect(api.summary).toContain('beta=true');
    expect(api.summary).toContain('available_to_take=false');
    expect(api.summary).toContain('identity/status only');
    expect(beta.verificationEvidence.at(-1)).toMatchObject({
      url: 'https://learn.microsoft.com/en-us/credentials/certifications/agentic-ai-developer/',
      retrievedAt: '2026-09-14T17:48:36.577Z',
    });
    expect(validateCatalog(credentials, heroClasses)).toEqual([]);
  });

  it('exposes only the fully reviewed bank without lowering normal safeguards', () => {
    expect(packageSnapshot.reviewedQuestions).toHaveLength(136);
    expect(packageSnapshot.allQuestions).toHaveLength(149);
    expect(packageSnapshot.findings).toEqual([]);
    expect(packageSnapshot.questions).toEqual(
      packageSnapshot.reviewedQuestions,
    );
    expect(packageSnapshot.readiness).toMatchObject({
      study: true,
      gauntlet: true,
    });
    expect(packageSnapshot.packageManifest.readinessThresholds).toMatchObject({
      studyMinimum: 25,
      gauntletMinimum: 75,
      minimumQuestionsPerSkill: 2,
    });
    expect(packageSnapshot.packageManifest.reviewPolicy).toMatchObject({
      version: 'three-pass-v1',
      minimumRubricScore: 44,
      targetVerified: 150,
    });
    expect(
      packageSnapshot.reviewedQuestions.filter(
        (question) => question.complexity !== 'concept-recall',
      ),
    ).toHaveLength(130);
    const stats = buildContentStats(
      packageSnapshot.reviewedQuestions,
      packageSnapshot.taxonomy,
      packageSnapshot.objectiveVersion,
    );
    expect(stats).toMatchObject({
      coveredFloorCount: 6,
      coveredSkillCount: 19,
      bossQuestionCount: 56,
    });
    expect(
      getDungeonReadiness({ ...beta, contentReadiness: 'ready' }, stats),
    ).toMatchObject({ study: true, gauntlet: true });
    for (const contentReadiness of [
      'stale',
      'unavailable',
      'validating',
    ] as const) {
      expect(
        getDungeonReadiness({ ...beta, contentReadiness }, stats),
      ).toMatchObject({ study: false, gauntlet: false });
    }
    for (const blockedStats of [
      { ...stats, verifiedQuestionCount: 24 },
      { ...stats, coveredFloorCount: 5 },
      { ...stats, blockingFailures: ['Independent review failed.'] },
      { ...stats, objectiveVersion: 'Changed objective map' },
    ]) {
      expect(getDungeonReadiness(beta, blockedStats)).toMatchObject({
        study: false,
        gauntlet: false,
      });
    }
    for (const limitedStats of [
      { ...stats, verifiedQuestionCount: 74 },
      { ...stats, coveredSkillCount: 18 },
      { ...stats, bossQuestionCount: 0 },
      { ...stats, weightingPublished: true, weightingAvailable: false },
      { ...stats, majorGaps: ['Insufficient applied reasoning.'] },
    ]) {
      expect(getDungeonReadiness(beta, limitedStats)).toMatchObject({
        study: true,
        gauntlet: false,
      });
    }
  });

  it('rejects direct callers without beta authorization or a verified eligible identity', () => {
    const blockedCredentials = [
      { ...beta, allowBetaPlay: undefined },
      { ...beta, allowBetaPlay: false },
      { ...beta, isVerified: false },
      ...(
        ['announced', 'retiring', 'retired', 'replaced', 'unverified'] as const
      ).map((status) => ({ ...beta, status })),
    ];
    for (const credential of blockedCredentials) {
      const claimedReady = {
        ...packageSnapshot,
        credential,
        questions: packageSnapshot.reviewedQuestions,
        readiness: { study: true, gauntlet: true, reasons: [] },
      };
      expect(
        getDungeonReadiness(
          credential,
          buildContentStats(
            packageSnapshot.reviewedQuestions,
            packageSnapshot.taxonomy,
            packageSnapshot.objectiveVersion,
          ),
        ),
      ).toMatchObject({ study: false, gauntlet: false });
      expect(dungeonAccess(claimedReady).allowed).toBe(false);
      expect(dungeonAccess(claimedReady, true).allowed).toBe(false);
      for (const mode of modes) {
        expect(
          planDungeonSession([getDungeonPackage('dp-700'), claimedReady], {
            ...defaultConfig,
            credentialId: betaId,
            ...mode,
          }).ok,
        ).toBe(false);
      }
    }
    for (const credential of credentials) {
      if (credential.credentialId === betaId) continue;
      if (credential.isVerified && credential.status === 'active') continue;
      expect(
        dungeonAccess(getDungeonPackage(credential.credentialId)).allowed,
      ).toBe(false);
    }
    expect(dungeonAccess(getDungeonPackage('dp-700')).allowed).toBe(true);
  });

  it.each(modes)(
    'plans $runMode/$answerMode using only playable reviewed encounters',
    (mode) => {
      const session = planDungeonSession(
        [getDungeonPackage('dp-700'), packageSnapshot],
        { ...defaultConfig, credentialId: betaId, ...mode },
      );
      expect(session.ok).toBe(true);
      if (!session.ok) throw new Error(session.warnings.join(' '));
      expect(session.plan.questions).toHaveLength(defaultConfig.questionCount);
      const betaQuestions = session.plan.questions.filter(
        (question) =>
          session.plan.questionOrigins[question.id].credentialId === betaId,
      );
      expect(betaQuestions.length).toBeGreaterThan(0);
      for (const question of betaQuestions) {
        expect(question.verificationStatus).toBe('verified');
        expect(
          packageSnapshot.reviewedQuestions.map((entry) => entry.id),
        ).toContain(question.id);
      }
    },
  );

  it('requires objective and preparation evidence even for explicitly enabled beta access', () => {
    for (const officialUrls of [
      { ...beta.officialUrls, studyGuide: null },
      { ...beta.officialUrls, training: null },
    ]) {
      expect(
        validateCatalog(
          credentials.map((entry) =>
            entry.credentialId === betaId ? { ...entry, officialUrls } : entry,
          ),
          heroClasses,
        ).join(' '),
      ).toMatch(/current objective version, study guide and preparation URL/);
    }
    expect(
      validateCatalog(
        credentials.map((entry) =>
          entry.credentialId === betaId
            ? {
                ...entry,
                verificationEvidence: entry.verificationEvidence.filter(
                  (evidence) => evidence.url !== entry.officialUrls.studyGuide,
                ),
              }
            : entry,
        ),
        heroClasses,
      ).join(' '),
    ).toMatch(/actual retrieval evidence/);
  });

  it('prominently identifies the open beta card without confusing beta with product preview', () => {
    mountPage(`/dungeons/${betaId}`);
    const card = screen.getByRole('article', {
      name: 'GH-600 The Agentic Workshop',
    });
    const notice = within(card).getByRole('complementary', {
      name: 'GH-600 beta availability',
    });
    expect(notice).toHaveTextContent('BETA · Study access open');
    expect(notice).toHaveTextContent('Objectives may change.');
    expect(notice).toHaveTextContent('Unofficial study aid');
    expect(notice).not.toHaveTextContent('Preview feature');
    expect(within(card).getByRole('button', { name: 'Descend' })).toBeEnabled();
    expect(
      within(card).getByRole('button', { name: 'Boss Gauntlet' }),
    ).toBeEnabled();
    expect(card.querySelector('.encounter-count')).toHaveTextContent(
      /136\s*playable verified encounters/,
    );
    expect(within(card).getByText('beta', { exact: true })).toBeVisible();
    expect(
      screen.getByRole('option', {
        name: /GH-600.*BETA.*Open/,
      }),
    ).toBeInTheDocument();
  });

  it.each([
    {
      study: false,
      gauntlet: false,
      message: 'Torchlight Run and Boss Gauntlet remain sealed.',
    },
    {
      study: true,
      gauntlet: false,
      message:
        'Torchlight Run is open for beta study; Boss Gauntlet remains sealed.',
    },
  ])(
    'reports actual beta mode readiness: $message',
    ({ study, gauntlet, message }) => {
      render(
        <BetaAvailabilityNotice
          credential={beta}
          readiness={{ study, gauntlet, reasons: [] }}
        />,
      );
      expect(screen.getByRole('complementary')).toHaveTextContent(message);
    },
  );

  it.each(['active', 'retired', 'unverified'] as const)(
    'does not label a %s credential as beta',
    (status) => {
      const { container } = render(
        <BetaAvailabilityNotice credential={{ ...beta, status }} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it.each(modes)(
    'opens imported $runMode/$answerMode setup and leaves history unchanged',
    (mode) => {
      const data = importSettings(mode);
      mountPage('/setup');
      expect(
        screen.getByRole('complementary', {
          name: 'GH-600 beta availability',
        }),
      ).toHaveTextContent(
        'Torchlight Run and Boss Gauntlet are open for beta study.',
      );
      expect(screen.getByRole('button', { name: 'Descend' })).toBeEnabled();
      expect(loadData(localStorage).data.history).toEqual(data.history);
    },
  );

  it.each(modes)(
    'starts imported $runMode/$answerMode at the provider boundary',
    async (mode) => {
      const data = importSettings(mode);
      const user = userEvent.setup();
      render(
        <GameProvider>
          <Commands />
        </GameProvider>,
      );
      if (data.selectedCredentialId === betaId)
        expect(screen.getByText('Bank: 136')).toBeVisible();
      await user.click(
        screen.getByRole('button', { name: 'Start imported configuration' }),
      );
      expect(screen.getByText(/^Active:/)).not.toHaveTextContent('none');
      expect(screen.getByText(/^Notices:/)).not.toHaveTextContent(/sealed/i);
      expect(loadData(localStorage).data.history).toEqual(data.history);
    },
  );

  it('can select the beta dungeon from an otherwise playable credential', async () => {
    const user = userEvent.setup();
    render(
      <GameProvider>
        <Commands />
      </GameProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Select beta' }));
    expect(screen.getByText(`Selected: ${betaId}`)).toBeVisible();
    expect(screen.getByText('Bank: 136')).toBeVisible();
    expect(screen.getByText('Active: none')).toBeVisible();
  });
});
