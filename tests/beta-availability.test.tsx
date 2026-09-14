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

describe('grounded GH-600 beta identity without beta gameplay', () => {
  it('records beta evidence, not GA or a gameplay approval', () => {
    expect(beta).toMatchObject({
      examCode: 'GH-600',
      currentName: 'GitHub Certified: Agentic AI Developer',
      status: 'beta',
      isVerified: true,
      contentReadiness: 'unavailable',
      verifiedQuestionCount: 0,
      minimumPlayableQuestionCount: 25,
    });
    expect(beta).not.toHaveProperty('allowBetaPlay');
    expect(beta.sealedReason).toMatch(/available_to_take=false/);
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

  it('preserves the reviewed bank and normal safeguards while exposing no encounters', () => {
    expect(packageSnapshot.reviewedQuestions).toHaveLength(136);
    expect(packageSnapshot.allQuestions).toHaveLength(149);
    expect(packageSnapshot.findings).toEqual([]);
    expect(packageSnapshot.questions).toEqual([]);
    expect(packageSnapshot.readiness).toMatchObject({
      study: false,
      gauntlet: false,
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
    ).toMatchObject({ study: false, gauntlet: false });
  });

  it('rejects direct callers that fabricate ready content for any nonactive identity', () => {
    for (const status of [
      'announced',
      'beta',
      'retiring',
      'retired',
      'replaced',
      'unverified',
    ] as const) {
      const claimedReady = {
        ...packageSnapshot,
        credential: { ...beta, status, contentReadiness: 'ready' as const },
        questions: packageSnapshot.reviewedQuestions,
        readiness: { study: true, gauntlet: true, reasons: [] },
      };
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
      if (credential.isVerified && credential.status === 'active') continue;
      expect(
        dungeonAccess(getDungeonPackage(credential.credentialId)).allowed,
      ).toBe(false);
    }
    expect(dungeonAccess(getDungeonPackage('dp-700')).allowed).toBe(true);
  });

  it('prominently identifies the sealed card without confusing beta with product preview', () => {
    mountPage(`/dungeons/${betaId}`);
    const card = screen.getByRole('article', {
      name: 'GH-600 The Agentic Workshop',
    });
    const notice = within(card).getByRole('complementary', {
      name: 'GH-600 beta availability',
    });
    expect(notice).toHaveTextContent('BETA · Gameplay unavailable');
    expect(notice).toHaveTextContent('Objectives may change.');
    expect(notice).toHaveTextContent('Unofficial study aid');
    expect(notice).not.toHaveTextContent('Preview feature');
    expect(within(card).getByRole('button', { name: 'Sealed' })).toBeDisabled();
    expect(
      within(card).getByRole('button', { name: 'Boss Gauntlet' }),
    ).toBeDisabled();
    expect(
      within(card).getByText(
        /136 fully reviewed encounters remain unavailable/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('option', {
        name: /GH-600.*BETA.*Sealed/,
      }),
    ).toBeInTheDocument();
  });

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
    'keeps imported $runMode/$answerMode setup sealed and leaves history unchanged',
    (mode) => {
      const data = importSettings(mode);
      mountPage('/setup');
      expect(
        screen.getByRole('complementary', {
          name: 'GH-600 beta availability',
        }),
      ).toHaveTextContent('Torchlight Run and Boss Gauntlet remain sealed.');
      expect(screen.getByRole('button', { name: 'Descend' })).toBeDisabled();
      expect(loadData(localStorage).data.history).toEqual(data.history);
    },
  );

  it.each(modes)(
    'refuses imported $runMode/$answerMode at the provider boundary',
    async (mode) => {
      const data = importSettings(mode);
      const user = userEvent.setup();
      render(
        <GameProvider>
          <Commands />
        </GameProvider>,
      );
      if (data.selectedCredentialId === betaId)
        expect(screen.getByText('Bank: 0')).toBeVisible();
      await user.click(
        screen.getByRole('button', { name: 'Start imported configuration' }),
      );
      expect(screen.getByText('Active: none')).toBeVisible();
      expect(screen.getByText(/^Notices:/)).toHaveTextContent(/sealed/i);
      expect(loadData(localStorage).data.history).toEqual(data.history);
    },
  );

  it('cannot select the beta dungeon from an otherwise playable credential', async () => {
    const user = userEvent.setup();
    render(
      <GameProvider>
        <Commands />
      </GameProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Select beta' }));
    expect(screen.getByText('Selected: dp-700')).toBeVisible();
    expect(screen.getByText('Active: none')).toBeVisible();
  });
});
