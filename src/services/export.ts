import { learnUrlSchema, type Taxonomy } from '../features/grounding/schema';
import type { SessionResult } from '../features/quiz/types';
import { scoreSession } from '../features/results/scoring';

export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char,
  );
}

export function resultJson(result: SessionResult, taxonomy: Taxonomy) {
  return JSON.stringify(
    {
      ...result,
      summary: scoreSession(result, taxonomy),
      disclaimer:
        'Unofficial study aid. Not a certification score or prediction.',
    },
    null,
    2,
  );
}

export function resultHtml(result: SessionResult, taxonomy: Taxonomy) {
  const score = scoreSession(result, taxonomy);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fabric Challenge results</title><style>body{font:16px/1.6 system-ui;max-width:900px;margin:2rem auto;padding:1rem;color:#152a26}section{break-inside:avoid;border-top:1px solid #bbb;padding-block:1rem}a{color:#075f50}pre{white-space:pre-wrap}button{padding:.6rem}@media print{button{display:none}}</style></head><body><h1>Fabric Data Engineer Challenge</h1><p>Unofficial study aid. Not affiliated with or endorsed by Microsoft Certification.</p><p>${score.correct}/${score.total} correct (${score.percentage}%). ${score.incorrect} incorrect; ${score.unanswered} unanswered.</p><p>Completed ${escapeHtml(result.completedAt)}. Grounded ${escapeHtml(result.groundedAt)}.</p><p>Use your browser's Print command to print or save as PDF.</p><h2>Objective domains</h2>${score.byDomain.map((d) => `<p>${escapeHtml(d.label)}: ${d.correct}/${d.total}${d.insufficient ? ' (small sample)' : ''}</p>`).join('')}<h2>Question review</h2>${score.rows
    .map(
      (row, i) =>
        `<section><h3>${i + 1}. ${escapeHtml(row.question.question)}</h3><p>${row.correct ? 'Correct' : row.answered ? 'Incorrect' : 'Unanswered'}${row.response?.flagged ? ' | Flagged' : ''} | ${((row.response?.timeMs ?? 0) / 1000).toFixed(1)} seconds</p>${row.question.codeSnippet ? `<pre>${escapeHtml(row.question.codeSnippet)}</pre>` : ''}<p>Your answer: ${escapeHtml(
          row.question.answerChoices
            .filter((c) => row.response?.selectedAnswer.includes(c.id))
            .map((c) => c.text)
            .join('; ') || 'Unanswered',
        )}</p><p>Correct: ${escapeHtml(
          row.question.answerChoices
            .filter((c) => row.question.correctAnswer.includes(c.id))
            .map((c) => c.text)
            .join('; '),
        )}</p><p>${escapeHtml(row.question.explanation)}</p><p>${escapeHtml(row.question.deepExplanation)}</p>${Object.entries(
          row.question.whyOtherAnswersAreWrong,
        )
          .map(
            ([id, why]) =>
              `<p>${escapeHtml(row.question.answerChoices.find((c) => c.id === id)?.text ?? id)}: ${escapeHtml(why)}</p>`,
          )
          .join(
            '',
          )}${row.question.sourceUrls.map((url, index) => `<p><a href="${escapeHtml(learnUrlSchema.parse(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.question.documentationTitles[index])}</a></p>`).join('')}</section>`,
    )
    .join(
      '',
    )}<p>Original questions from public documentation, not real exam questions. Product behavior and objectives can change.</p></body></html>`;
}

export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
