import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { QuestionMetadata } from '../src/components/QuestionContent';
import { question, taxonomy } from './fixtures';
import { questionFingerprint } from '../src/features/dungeons/review';

vi.mock('../src/features/quiz/context', () => ({
  useGame: () => ({ active: null, selectedCredentialId: 'dp-700', taxonomy }),
}));

it('shows study metadata rather than historical authoring-state tags without changing reviewed facts', () => {
  const workflow = [
    'original-grounded-candidate',
    'original-pass1',
    'pass-1-candidate',
    'pass1-candidate',
    'pass1-only',
  ];
  const record = question('topic-tags-fixture', {
    tags: [...workflow, 'retrieval', 'candidate-generation'],
    featureStatus: 'Preview',
  });
  const hash = questionFingerprint(record);
  render(
    <QuestionMetadata
      question={record}
      taxonomySnapshot={taxonomy}
      credentialId="dp-700"
    />,
  );
  for (const tag of workflow)
    expect(screen.queryByText(tag, { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText('retrieval', { exact: true })).toBeInTheDocument();
  expect(
    screen.getByText('candidate-generation', { exact: true }),
  ).toBeInTheDocument();
  expect(screen.getByText('Preview feature')).toBeInTheDocument();
  expect(questionFingerprint(record)).toBe(hash);
  expect(record.tags).toEqual([
    ...workflow,
    'retrieval',
    'candidate-generation',
  ]);
});
