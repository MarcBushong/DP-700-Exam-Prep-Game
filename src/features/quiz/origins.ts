import type { ActiveSession, QuestionOrigin, SessionResult } from './types';

export const LEGACY_CREDENTIAL_ID = 'dp-700';
export const LEGACY_OBJECTIVE_VERSION = 'legacy-unknown';

type SessionIdentity = Pick<
  ActiveSession,
  'credentialId' | 'config' | 'questionOrigins' | 'objectiveSnapshots'
>;

export function questionOrigin(
  session: SessionIdentity,
  questionId: string,
): QuestionOrigin {
  return (
    session.questionOrigins?.[questionId] ?? {
      credentialId:
        session.credentialId ??
        session.config.credentialId ??
        LEGACY_CREDENTIAL_ID,
      objectiveVersion: LEGACY_OBJECTIVE_VERSION,
    }
  );
}

export function historyForCredential(
  history: SessionResult[],
  credentialId: string,
): SessionResult[] {
  return history.flatMap((result) => {
    const questions = result.questions.filter(
      (q) => questionOrigin(result, q.id).credentialId === credentialId,
    );
    if (!questions.length) return [];
    const ids = new Set(questions.map((q) => q.id));
    return [
      {
        ...result,
        credentialId,
        config: { ...result.config, credentialId },
        questions,
        responses: result.responses.filter((r) => ids.has(r.questionId)),
        questionOrigins: Object.fromEntries(
          questions.map((q) => [q.id, questionOrigin(result, q.id)]),
        ),
      },
    ];
  });
}

export function withSessionOrigins(result: SessionResult): SessionResult {
  return {
    ...result,
    credentialId:
      result.credentialId ?? result.config.credentialId ?? LEGACY_CREDENTIAL_ID,
    questionOrigins: Object.fromEntries(
      result.questions.map((q) => [q.id, questionOrigin(result, q.id)]),
    ),
    objectiveSnapshots: result.objectiveSnapshots ?? {},
  };
}
