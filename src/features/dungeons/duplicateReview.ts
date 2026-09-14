import { z } from 'zod';
import {
  timestampSchema,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import {
  codeShape,
  duplicateFindings,
  normalizedChoice,
  type ContentFinding,
} from '../grounding/quality';
import { objectiveFingerprint, questionFingerprint } from './review';

/** Preserve comparison/template operators; only named scenario entities are cosmetic. */
export function normalizedScenario(text: string): string {
  return normalizedChoice(text)
    .replace(
      /\b(company|organization|organisation|repository|repo|team|developer|user)\s+(?:named\s+)?[`"'][^`"']+[`"']/g,
      '$1 entity',
    )
    .replace(
      /\b(company|organization|organisation|repository|repo|team|developer|user)\s+(?:named|called)\s+[\p{L}\p{N}_-]+/gu,
      '$1 entity',
    )
    .replace(/\b(?:contoso|fabrikam|adventureworks|northwind)\b/g, 'company')
    .replace(/\s+/g, ' ');
}

/** Additional heuristics are review warnings, not semantic AI or automatic rejection. */
export function scenarioDuplicateFindings(
  questions: Question[],
): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const normalized = questions.map((question) => ({
    scenario: [
      normalizedScenario(question.question),
      question.answerChoices
        .map((choice) => normalizedScenario(choice.text))
        .sort()
        .join('|'),
    ].join('\n'),
    code: codeShape(question.codeSnippet ?? ''),
  }));
  for (let i = 0; i < questions.length; i++)
    for (let j = i + 1; j < questions.length; j++) {
      const left = questions[i],
        right = questions[j];
      if (
        normalized[i].scenario === normalized[j].scenario &&
        normalized[i].code === normalized[j].code
      )
        findings.push({
          code: 'cosmetic-scenario',
          category: 'duplicate',
          severity: 'warning',
          questionIds: [left.id, right.id],
          message: `${left.id} / ${right.id}: normalized entities and choice order suggest a cosmetic scenario. Independently compare the tested reasoning.`,
        });
    }
  return findings;
}

const summary = z.string().trim().min(20);
export const semanticDecisionSchema = z
  .object({
    schemaVersion: z.literal(1),
    decisions: z.array(
      z
        .object({
          conceptId: z.string().min(1),
          questionIds: z.tuple([z.string().min(1), z.string().min(1)]),
          questionFingerprints: z.record(
            z.string(),
            z.string().regex(/^[a-f0-9]{64}$/),
          ),
          objectiveFingerprints: z.record(
            z.string(),
            z.string().regex(/^[a-f0-9]{64}$/),
          ),
          reviewerId: z.string().trim().min(1),
          reviewedAt: timestampSchema,
          decision: z.enum([
            'keep-distinct',
            'reject-duplicate',
            'manual-review-required',
          ]),
          reasoningDifference: summary,
          notes: summary,
        })
        .strict(),
    ),
  })
  .strict();

export interface CrossExamBank {
  credentialId: string;
  allQuestions: Question[];
  taxonomy: Taxonomy;
}

export function crossExamDuplicateReport(
  banks: CrossExamBank[],
  decisions?: unknown,
) {
  const parsed =
    decisions === undefined
      ? undefined
      : semanticDecisionSchema.safeParse(decisions);
  const records = parsed?.success ? parsed.data.decisions : [];
  const warnings: ContentFinding[] = [];
  const decisionsUsed: z.infer<typeof semanticDecisionSchema>['decisions'] = [];
  for (let i = 0; i < banks.length; i++)
    for (let j = i + 1; j < banks.length; j++) {
      const left = banks[i],
        right = banks[j];
      const leftIds = new Set(left.allQuestions.map((q) => q.id));
      const rightIds = new Set(right.allQuestions.map((q) => q.id));
      const findings = [
        ...duplicateFindings([...left.allQuestions, ...right.allQuestions]),
        ...scenarioDuplicateFindings([
          ...left.allQuestions,
          ...right.allQuestions,
        ]),
      ].filter(
        (finding) =>
          finding.questionIds.some((id) => leftIds.has(id)) &&
          finding.questionIds.some((id) => rightIds.has(id)),
      );
      for (const finding of findings) {
        const a = left.allQuestions.find((q) =>
          finding.questionIds.includes(q.id),
        )!;
        const b = right.allQuestions.find((q) =>
          finding.questionIds.includes(q.id),
        )!;
        const decision = records.find(
          (record) =>
            record.conceptId === a.conceptId &&
            a.conceptId === b.conceptId &&
            record.questionIds.includes(a.id) &&
            record.questionIds.includes(b.id) &&
            record.questionFingerprints[a.id] === questionFingerprint(a) &&
            record.questionFingerprints[b.id] === questionFingerprint(b) &&
            record.objectiveFingerprints[left.credentialId] ===
              objectiveFingerprint(left.taxonomy) &&
            record.objectiveFingerprints[right.credentialId] ===
              objectiveFingerprint(right.taxonomy) &&
            Date.parse(record.reviewedAt) >=
              Math.max(
                Date.parse(left.taxonomy.retrievedAt),
                Date.parse(right.taxonomy.retrievedAt),
                Date.parse(a.lastValidatedAt),
                Date.parse(b.lastValidatedAt),
              ) &&
            Date.parse(record.reviewedAt) <= Date.now(),
        );
        if (decision) decisionsUsed.push(decision);
        warnings.push({
          ...finding,
          severity: 'warning',
          message: `${left.credentialId} / ${right.credentialId}: ${finding.message} ${decision ? `Recorded semantic decision: ${decision.decision}. ${decision.reasoningDifference}` : 'No current independently recorded reasoning distinction; manual review required.'}`,
        });
      }
    }
  return {
    disclaimer:
      'Cross-exam checks are deterministic editorial warnings, not semantic AI. Recorded decisions do not prove reasoning differs. Global question ID collisions remain blocking separately.',
    warnings,
    decisionsUsed,
    decisionErrors: parsed && !parsed.success ? [parsed.error.message] : [],
    unusedDecisionCount: records.filter(
      (record) => !decisionsUsed.includes(record),
    ).length,
  };
}
