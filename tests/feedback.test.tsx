import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  CodeSnippet,
  QuestionExplanation,
} from '../src/components/QuestionContent';
import { ReactionSession } from '../src/features/personality/reactions';
import { question } from './fixtures';

it('presents syntax tokens without changing or interpreting the source code', () => {
  const codeSnippet =
    'SELECT "<script>literal</script>" AS value;\n-- preserved comment\nWHERE amount = 42';
  const sample = question('synthetic-code', {
    codeSnippet,
    codeLanguage: 'sql',
  });
  const { container } = render(<CodeSnippet question={sample} />);
  expect(container.querySelector('code')?.textContent).toBe(codeSnippet);
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelectorAll('.syntax-keyword').length).toBeGreaterThan(
    0,
  );
});

it('removes game-host reactions without removing direct technical feedback', () => {
  const sample = question();
  const reaction = new ReactionSession().react(
    'answer',
    ['correct'],
    {},
    'full',
    'answer',
  );
  const { container, rerender } = render(
    <QuestionExplanation
      question={sample}
      selected={['a']}
      revealAnswer
      reaction={reaction}
    />,
  );
  expect(container.querySelector('.banter')).toHaveTextContent(
    reaction!.renderedText,
  );
  expect(screen.getByRole('heading', { name: 'Correct.' })).toBeVisible();
  rerender(
    <QuestionExplanation question={sample} selected={['a']} revealAnswer />,
  );
  expect(container.querySelector('.banter')).toBeNull();
  expect(screen.getByText(sample.explanation)).toBeVisible();
});

it('cannot reveal an outcome reaction in explanations-only review even if passed one', () => {
  const sample = question();
  const reaction = new ReactionSession().react(
    'answer',
    ['correct'],
    {},
    'full',
    'answer',
  );
  const { container } = render(
    <QuestionExplanation
      question={sample}
      selected={['a']}
      revealAnswer={false}
      reaction={reaction}
    />,
  );
  expect(container.querySelector('.banter')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Correct.' })).toBeNull();
  expect(screen.queryByText(/Correct answer:/)).toBeNull();
  expect(screen.getByText(sample.explanation)).toBeVisible();
});
