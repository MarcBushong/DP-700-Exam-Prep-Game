import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { QuestionExplanation } from '../src/components/QuestionContent';
import { question } from './fixtures';

it('removes game-host banter without removing technical feedback', () => {
  const sample = question();
  const { container, rerender } = render(
    <QuestionExplanation
      question={sample}
      selected={['a']}
      revealAnswer
      banter
    />,
  );
  expect(container.querySelector('.banter')).toHaveTextContent(
    'The pipeline has declined to fail dramatically.',
  );
  rerender(
    <QuestionExplanation
      question={sample}
      selected={['a']}
      revealAnswer
      banter={false}
    />,
  );
  expect(container.querySelector('.banter')).toBeNull();
  expect(screen.getByText(sample.explanation)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Correct.' })).toBeVisible();
});
