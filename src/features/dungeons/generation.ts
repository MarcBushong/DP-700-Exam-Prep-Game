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
      'Author original candidates and every distractor. Generation output remains manual-review-required.',
      'A separate reviewer must re-evaluate every option, explanation, code operation, prerequisite, feature status, source relevance, and realism criterion.',
      'Never invent evidence, reviewer scores or dates. Unsupported or ambiguous content stays excluded. Source/rubric fingerprints must match exact candidate content.',
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
