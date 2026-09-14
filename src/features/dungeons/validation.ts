import {
  inspectContent,
  type GroundingManifest,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import type { ContentFinding } from '../grounding/quality';
import {
  verificationReviewSchema,
  type VerificationReview,
} from '../grounding/workflow';
import {
  buildContentStats,
  getDungeonReadiness,
  passesRealismRubric,
} from './readiness';
import {
  objectiveFingerprint,
  questionFingerprint,
  validateReviewAttestations,
} from './review';
import {
  encounterMetadataSchema,
  encounterMetadataFileSchema,
  packageManifestSchema,
  type Credential,
  type DungeonReadiness,
  type EncounterMetadataFile,
  type PackageManifest,
  type ReviewPolicy,
} from './schema';
import {
  validatedSupportingSourceIds,
  validateSourceProvenance,
} from './provenance';
import { validateThreePassReviews } from './threePass';
import { scenarioDuplicateFindings } from './duplicateReview';

export interface RawDungeonPackage {
  packageManifest: unknown;
  questions: unknown;
  taxonomy: unknown;
  manifest: unknown;
  reviews: unknown;
  encounterMetadata: unknown;
  personality?: unknown;
  validationMetadata?: unknown;
  sourceRegistry?: unknown;
}

export interface DungeonPackage {
  credential: Credential;
  questions: Question[];
  allQuestions: Question[];
  taxonomy: Taxonomy;
  manifest: GroundingManifest;
  reviews: VerificationReview;
  encounterMetadata: EncounterMetadataFile;
  packageManifest: PackageManifest;
  readiness: DungeonReadiness;
  objectiveVersion: string;
  findings: ContentFinding[];
  totalRecords: number;
  totalSourceRecords: number;
  personality?: unknown;
  validationMetadata?: unknown;
  sourceRegistry?: unknown;
  reviewedQuestions: Question[];
}

const sameIds = (left: string[], right: string[]) =>
  left.length === right.length &&
  new Set(left).size === left.length &&
  left.every((id) => right.includes(id));

/** Validates recorded evidence, never generates evidence or promotes a candidate. */
export function validateDungeonPackage(
  credential: Credential,
  raw: RawDungeonPackage,
): DungeonPackage {
  const packageManifest = packageManifestSchema.parse(raw.packageManifest);
  const requiredPolicy = credential.requiredReviewPolicy;
  const policy = requiredPolicy ?? packageManifest.reviewPolicy;
  const content = inspectContent(raw.questions, raw.manifest, raw.taxonomy, {
    ...credential,
    strictGuideLinked: Boolean(policy),
    validatedSupportingSourceIds: policy
      ? validatedSupportingSourceIds(
          credential,
          raw.taxonomy,
          raw.manifest,
          raw.sourceRegistry,
        )
      : undefined,
  });
  const findings = [...content.findings];
  const fail = (
    message: string,
    questionId?: string,
    code = 'package-validation',
  ) =>
    findings.push({
      code,
      category: 'verification',
      severity: 'error',
      questionIds: questionId ? [questionId] : [],
      message,
    });
  if (
    requiredPolicy &&
    (!packageManifest.reviewPolicy ||
      (Object.keys(requiredPolicy) as (keyof ReviewPolicy)[]).some(
        (key) => packageManifest.reviewPolicy?.[key] !== requiredPolicy[key],
      ))
  )
    fail(
      'The package reviewPolicy must exactly match the catalog requiredReviewPolicy. Missing or changed package policy cannot downgrade required provenance or three-pass review.',
      undefined,
      'review-policy-binding',
    );
  if (packageManifest.credentialId !== credential.credentialId)
    fail('Package identity differs from the catalog credential.');
  if (
    packageManifest.objectiveVersion !==
    content.taxonomy.studyGuideEffectiveDate
  )
    fail(
      'Package objective version differs from the published taxonomy version.',
    );
  if (
    credential.objectiveVersion &&
    credential.objectiveVersion !== packageManifest.objectiveVersion
  )
    fail(
      'Catalog objective version differs from the package; re-ground the map.',
    );
  if (
    credential.officialUrls.studyGuide &&
    credential.officialUrls.studyGuide !== content.taxonomy.studyGuideUrl
  )
    fail(
      'Package study guide does not match the credential competency outline.',
    );
  const reviewResult = verificationReviewSchema.safeParse(raw.reviews);
  const reviews = reviewResult.success
    ? reviewResult.data
    : { schemaVersion: 1 as const, requestId: 'invalid-ledger', reviews: [] };
  findings.push(
    ...validateReviewAttestations(
      content.allQuestions,
      content.manifest,
      raw.reviews,
    ),
  );
  const metadataResult = encounterMetadataFileSchema.safeParse(
    raw.encounterMetadata,
  );
  if (!metadataResult.success && !policy)
    fail(`Encounter metadata is invalid: ${metadataResult.error.message}`);
  const encounterMetadata: EncounterMetadataFile = metadataResult.success
    ? metadataResult.data
    : { schemaVersion: 1 as const, encounters: {} };
  if (policy && !metadataResult.success) {
    const value = raw.encounterMetadata as
      Partial<EncounterMetadataFile> | undefined;
    if (
      value?.schemaVersion !== 1 ||
      !value.encounters ||
      typeof value.encounters !== 'object'
    )
      fail('Required encounter metadata header is invalid.');
    else
      for (const [id, record] of Object.entries(value.encounters)) {
        const parsed = encounterMetadataSchema.safeParse(record);
        if (parsed.success) encounterMetadata.encounters[id] = parsed.data;
        else
          fail(`${id}: invalid evidence envelope: ${parsed.error.message}`, id);
      }
  }
  for (const id of Object.keys(encounterMetadata.encounters))
    if (!content.allQuestions.some((q) => q.id === id))
      fail('Metadata references an unknown encounter.', id);
  const currentObjectiveFingerprint = objectiveFingerprint(content.taxonomy);

  const allQuestions = content.allQuestions.map((original) => {
    const q = { ...original };
    const metadata = encounterMetadata.encounters[q.id];
    const review = reviews.reviews.find((item) => item.questionId === q.id);
    if (!metadata) {
      fail(
        `${q.id}: missing evidence envelope and independent realism rubric.`,
        q.id,
      );
      if (q.verificationStatus === 'verified') {
        q.verificationStatus = 'manual-review-required';
        q.requiresManualReview = true;
      }
      return q;
    }
    if (metadata.credentialId !== credential.credentialId)
      fail(`${q.id}: evidence envelope belongs to another credential.`, q.id);
    if (metadata.questionFingerprint !== questionFingerprint(original))
      fail(
        `${q.id}: content changed after its evidence/rubric snapshot.`,
        q.id,
      );
    if (!sameIds(metadata.sourceIds, q.sourceIds))
      fail(`${q.id}: envelope source IDs must match the question.`, q.id);
    if (
      metadata.objectiveVersion !== packageManifest.objectiveVersion ||
      (credential.objectiveVersion !== null &&
        metadata.objectiveVersion !== credential.objectiveVersion)
    ) {
      q.verificationStatus = 'stale';
      q.requiresManualReview = true;
      findings.push({
        code: 'objective-updated',
        category: 'verification',
        severity: 'warning',
        questionIds: [q.id],
        message: `${q.id}: objective version changed; preserve the historic snapshot and independently re-review.`,
      });
    }
    const currentSources = content.manifest.sources.filter((source) =>
      q.sourceIds.includes(source.sourceId),
    );
    const latestRetrieval = Math.max(
      ...currentSources.map((source) => Date.parse(source.retrievedAt)),
    );
    if (Date.parse(metadata.retrievedAt) !== latestRetrieval)
      fail(
        `${q.id}: evidence retrieval timestamp must match its latest cited source.`,
        q.id,
      );
    if (metadata.lastValidatedAt !== q.lastValidatedAt)
      fail(
        `${q.id}: envelope validation date must match the question snapshot.`,
        q.id,
      );
    for (const [evidence, expected, assessment] of [
      [metadata.answerEvidence, q.correctAnswer, 'supported'],
      [
        metadata.distractorEvidence,
        q.answerChoices
          .map((choice) => choice.id)
          .filter((id) => !q.correctAnswer.includes(id)),
        'contradicted',
      ],
    ] as const) {
      if (
        !sameIds(
          evidence.map((claim) => claim.choiceId),
          [...expected],
        )
      )
        fail(
          `${q.id}: evidence must cover each ${assessment === 'supported' ? 'answer' : 'distractor'} exactly once.`,
          q.id,
        );
      for (const claim of evidence) {
        const optionReview = review?.choiceReviews.find(
          (choice) => choice.choiceId === claim.choiceId,
        );
        if (
          !claim.sourceIds.every((id) => q.sourceIds.includes(id)) ||
          !optionReview ||
          !sameIds(claim.sourceIds, optionReview.sourceIds) ||
          (q.verificationStatus === 'verified' &&
            optionReview.assessment !== assessment) ||
          claim.summary !== optionReview.rationale
        )
          fail(
            `${q.id}: ${claim.choiceId} evidence does not match its independently attested option rationale and sources.`,
            q.id,
          );
      }
    }
    const rubric = metadata.rubric;
    if (
      rubric &&
      (rubric.objectiveVersion !== packageManifest.objectiveVersion ||
        rubric.objectiveVersion !== content.taxonomy.studyGuideEffectiveDate ||
        rubric.objectiveFingerprint !== currentObjectiveFingerprint ||
        Date.parse(rubric.reviewedAt) <
          Date.parse(content.taxonomy.retrievedAt))
    ) {
      q.verificationStatus = 'stale';
      q.requiresManualReview = true;
      findings.push({
        code: 'objective-review-stale',
        category: 'verification',
        severity: 'warning',
        questionIds: [q.id],
        message: `${q.id}: the independent rubric is not bound to the current objective map/version or predates its retrieval; independently re-read the outline and review this encounter.`,
      });
    }
    if (
      rubric &&
      (rubric.reviewerId.trim().toLowerCase() ===
        review?.authorId.trim().toLowerCase() ||
        Date.parse(rubric.reviewedAt) <
          Math.max(
            Date.parse(q.lastValidatedAt),
            ...currentSources.map((source) =>
              Date.parse(source.lastReviewedAt),
            ),
          ) ||
        Date.parse(rubric.reviewedAt) > Date.now())
    )
      fail(
        `${q.id}: rubric must be independently reviewed after validation/source review, never in the future.`,
        q.id,
      );
    if (
      q.verificationStatus === 'verified' &&
      !passesRealismRubric(
        rubric,
        policy?.minimumRubricScore ??
          packageManifest.readinessThresholds.rubricMinimum,
      )
    ) {
      fail(
        `${q.id}: realism rubric is absent or below the product quality threshold.`,
        q.id,
      );
      q.verificationStatus = 'manual-review-required';
      q.requiresManualReview = true;
    }
    if (!credential.supportedQuestionTypes.includes(q.questionType))
      fail(`${q.id}: unsupported question type for this credential.`, q.id);
    return q;
  });
  if (policy) {
    findings.push(
      ...scenarioDuplicateFindings(content.allQuestions),
      ...validateSourceProvenance(
        credential,
        content.taxonomy,
        content.manifest,
        content.allQuestions,
        raw.sourceRegistry,
      ),
      ...validateThreePassReviews(
        content.allQuestions,
        content.taxonomy,
        content.manifest,
        reviews,
        encounterMetadata,
        policy,
        raw.validationMetadata,
      ),
    );
    // An explicitly nonverified, schema-valid record is a reportable quarantine,
    // not permission to block unrelated reviewed encounters or quietly promote it.
    for (const finding of findings)
      if (
        finding.questionIds.length &&
        finding.questionIds.every((id) =>
          content.allQuestions.some(
            (q) => q.id === id && q.verificationStatus !== 'verified',
          ),
        )
      )
        finding.severity = 'warning';
  }
  const blocking = findings.filter((finding) => finding.severity !== 'warning');
  const globalError = blocking.some((finding) => !finding.questionIds.length);
  const blockedIds = new Set(
    blocking.flatMap((finding) => finding.questionIds),
  );
  const originallyPlayable = new Set(content.questions.map((q) => q.id));
  const verifiedQuestions = allQuestions.filter(
    (q) =>
      !globalError &&
      originallyPlayable.has(q.id) &&
      !blockedIds.has(q.id) &&
      q.verificationStatus === 'verified',
  );
  const stats = buildContentStats(
    verifiedQuestions,
    content.taxonomy,
    packageManifest.objectiveVersion,
    blocking.map((finding) => finding.message),
    packageManifest.readinessThresholds,
  );
  if (
    policy &&
    verifiedQuestions.length &&
    verifiedQuestions.filter(
      (question) => question.complexity !== 'concept-recall',
    ).length /
      verifiedQuestions.length <
      0.4
  )
    stats.majorGaps.push(
      'Boss Gauntlet needs at least 40% applied reasoning rather than concept recall.',
    );
  const readiness = getDungeonReadiness(credential, stats);
  return {
    ...content,
    credential,
    allQuestions,
    manifest: content.manifest,
    questions: readiness.study ? verifiedQuestions : [],
    reviews,
    encounterMetadata,
    packageManifest,
    readiness,
    objectiveVersion: packageManifest.objectiveVersion,
    findings,
    personality: raw.personality,
    validationMetadata: raw.validationMetadata,
    sourceRegistry: raw.sourceRegistry,
    reviewedQuestions: verifiedQuestions,
  };
}
