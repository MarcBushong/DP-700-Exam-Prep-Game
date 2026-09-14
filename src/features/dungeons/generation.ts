import {
  complexities,
  difficulties,
  formats,
  taxonomySchema,
  type Taxonomy,
} from '../grounding/schema';
import {
  generationRequestSchema,
  type GenerationRequest,
} from '../grounding/workflow';
import type { Credential } from './schema';

export interface GenerationOptions {
  requestId: string;
  authorId: string;
  requestedCount: number;
  createdAt: string;
  credentialId?: string;
  provider?: Credential['provider'];
  difficulties?: (typeof difficulties)[number][];
  difficultyMix?: Partial<Record<(typeof difficulties)[number], number>>;
  objectiveDomains?: string[];
  targetVerified?: number;
  reviewPolicy?: 'three-pass-v1';
}

export function parseDifficultyMix(value = 'mix') {
  if (value === 'mix' || value === 'mixed')
    return { difficulties: [...difficulties], difficultyMix: undefined };
  const entries = value.split(',').map((part) => part.trim());
  const hasWeights = entries.some((part) => part.includes(':'));
  const names: (typeof difficulties)[number][] = [];
  const mix: Partial<Record<(typeof difficulties)[number], number>> = {};
  for (const entry of entries) {
    const [name, rawWeight, extra] = entry.split(':');
    if (
      !difficulties.includes(name as (typeof difficulties)[number]) ||
      extra ||
      names.includes(name as (typeof difficulties)[number]) ||
      (hasWeights &&
        (!rawWeight ||
          !Number.isFinite(Number(rawWeight)) ||
          Number(rawWeight) <= 0))
    )
      throw new Error(
        'Use mix, a comma-separated difficulty list, or percentages such as advanced:60,expert:40.',
      );
    names.push(name as (typeof difficulties)[number]);
    if (hasWeights)
      mix[name as (typeof difficulties)[number]] = Number(rawWeight);
  }
  if (
    hasWeights &&
    Object.values(mix).reduce((sum, value) => sum + value, 0) !== 100
  )
    throw new Error('Difficulty percentages must sum to 100.');
  return { difficulties: names, difficultyMix: hasWeights ? mix : undefined };
}

/** A request is an authoring plan, not generated questions or retrieved evidence. */
export function buildGenerationRequest(
  taxonomyData: unknown,
  options: GenerationOptions,
): GenerationRequest {
  const taxonomy = taxonomySchema.parse(taxonomyData);
  const {
    provider = 'Microsoft',
    objectiveDomains,
    ...requestOptions
  } = options;
  if (
    objectiveDomains?.some(
      (id) => !taxonomy.domains.some((domain) => domain.id === id),
    )
  )
    throw new Error(
      'Generation targets must use current objective domain IDs.',
    );
  return generationRequestSchema.parse({
    schemaVersion: 1,
    ...requestOptions,
    credentialId: options.credentialId ?? 'dp-700',
    objectiveVersion: taxonomy.studyGuideEffectiveDate,
    objectiveTargets: taxonomy.domains
      .filter(
        (domain) => !objectiveDomains || objectiveDomains.includes(domain.id),
      )
      .flatMap((domain) =>
        domain.skills.flatMap((skill) =>
          skill.subskills.map((subskill) => ({
            objectiveDomain: domain.id,
            skill: skill.id,
            subskill,
          })),
        ),
      ),
    difficulties: options.difficulties ?? difficulties,
    ...(options.reviewPolicy
      ? {
          targetVerified: options.targetVerified ?? 150,
          difficultyLabels: { beginner: 'Foundational' },
          difficultyMix:
            options.difficultyMix ??
            (options.difficulties &&
            options.difficulties.length !== difficulties.length
              ? Object.fromEntries(
                  options.difficulties.map((name) => [
                    name,
                    100 / options.difficulties!.length,
                  ]),
                )
              : { beginner: 15, intermediate: 35, advanced: 35, expert: 15 }),
        }
      : {}),
    complexities,
    questionTypes: formats,
    studyGuideEffectiveDate: taxonomy.studyGuideEffectiveDate,
    taxonomyRetrievedAt: taxonomy.retrievedAt,
    primaryEvidence: {
      studyGuide: 'study-guide.json',
      certification: 'certification.json',
      course: 'course.json',
    },
    supportingEvidence: [],
    constraints: [
      `Scaffolding is not generation or evidence. Retrieve credential, competency outline, preparation material and supporting articles through ${provider === 'Microsoft' ? 'actual Microsoft Learn MCP' : 'official GitHub documentation'} before authoring.`,
      'Preserve published objectives, effective version, and actual retrieval timestamps. Unknown objective weighting remains unknown.',
      options.reviewPolicy
        ? 'Author original candidates only after guide-linked source approval. Generation output remains candidate, never verified. Technical and adversarial reviews use separate contexts and identities.'
        : 'Author original candidates and every distractor. Generation output remains manual-review-required.',
      'A separate reviewer must re-evaluate every option, explanation, code operation, prerequisite, feature status, source relevance, and realism criterion.',
      'Never invent evidence, reviewer scores or dates. Unsupported or ambiguous content stays excluded. Source/rubric fingerprints must match exact candidate content.',
      ...(options.reviewPolicy
        ? [
            'Retrieve current official Learn guide, credential, and self-paced training with actual Microsoft Learn MCP. Only guide/training-linked or explicitly referenced official Learn/GitHub Docs support technical claims.',
            'Target 150 verified per exam; candidate count is a planning goal, not a certified count. Do not pad or lower thresholds. Aim for at least 40% applied reasoning when objectives support it.',
            'Pass 3 must challenge every option and scope/plan/role/preconditions with sourced counterexamples. Record actual 12-criterion 0–4 rubric scores; critical scores must be 4, distractorEvidence >=3, total >=44.',
          ]
        : []),
    ],
  });
}

export function createGenerationRequest(
  credential: Credential,
  taxonomy: Taxonomy,
  options: Omit<GenerationOptions, 'credentialId' | 'provider'>,
) {
  return buildGenerationRequest(taxonomy, {
    ...options,
    reviewPolicy:
      credential.requiredReviewPolicy?.version ?? options.reviewPolicy,
    targetVerified:
      options.targetVerified ?? credential.requiredReviewPolicy?.targetVerified,
    credentialId: credential.credentialId,
    provider: credential.provider,
  });
}

/** Browser-safe download payload; the UI owns the accessible download interaction. */
export function downloadGenerationRequest(request: GenerationRequest) {
  const checked = generationRequestSchema.parse(request);
  return {
    fileName: `${checked.credentialId}-generation-request.json`,
    mimeType: 'application/json',
    content: `${JSON.stringify(checked, null, 2)}\n`,
  };
}
