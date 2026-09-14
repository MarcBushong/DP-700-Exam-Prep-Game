import type { Question } from './schema';

export interface ContentFinding {
  code: string;
  category:
    | 'schema'
    | 'citation'
    | 'mapping'
    | 'verification'
    | 'duplicate'
    | 'quality';
  severity: 'error' | 'blocking' | 'warning';
  questionIds: string[];
  message: string;
}

export function normalizedQuestion(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function normalizedChoice(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/g, '');
}

/** Preserve operators and literal values: changing SQL > to < is not cosmetic. */
function codeTokens(code: string): string[] {
  return (
    code.match(
      /'(?:''|\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`[^`]*`|[A-Za-z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|<>|&&|\|\||[^\s]/g,
    ) ?? []
  );
}

export function normalizedCode(code: string): string {
  return codeTokens(code).join(' ');
}

export function codeShape(code: string): string {
  const names = new Map<string, string>();
  return codeTokens(code)
    .map((name) => {
      if (!/^[A-Za-z_]\w*$/.test(name)) return name;
      if (
        /^(select|from|where|group|by|order|join|on|as|with|and|or|not|null|true|false|sum|count|avg|filter|col|lit|when|otherwise|df|spark|table|read|write|format|option|mode|save|delta|merge|into|using|matched|update|insert|delete|summarize|extend|project|arg_max|arg_min|bin|let|union|take|sort|desc|asc)$/i.test(
          name,
        )
      )
        return name.toLowerCase();
      if (!names.has(name)) names.set(name, `name${names.size}`);
      return names.get(name)!;
    })
    .join(' ');
}

function words(text: string): Set<string> {
  return new Set(
    normalizedQuestion(text)
      .split(' ')
      .filter(
        (word) =>
          word.length > 2 &&
          !/^(the|and|for|with|that|this|which|what|from|your|you|are|can|should|would)$/.test(
            word,
          ),
      ),
  );
}

function similarity(left: Set<string>, right: Set<string>): number {
  const common = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union ? common / union : 0;
}

export function duplicateFindings(questions: Question[]): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const normalized = questions.map((q) => ({
    stem: normalizedQuestion(q.question),
    operators: (
      q.question.match(/===|!==|==|!=|<=|>=|<>|=>|&&|\|\||@\{|\}|[<>+=*/]/g) ??
      []
    ).join(' '),
    words: words(q.question),
    code: normalizedCode(q.codeSnippet ?? ''),
    shape: codeShape(q.codeSnippet ?? ''),
    choices: q.answerChoices
      .map((choice) => normalizedChoice(choice.text))
      .sort()
      .join('|'),
  }));
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const a = normalized[i];
      const b = normalized[j];
      const left = questions[i];
      const right = questions[j];
      const lexical = similarity(a.words, b.words);
      const contained =
        [...a.words].every((word) => b.words.has(word)) ||
        [...b.words].every((word) => a.words.has(word));
      const sameCode = a.code === b.code;
      const sameChoices = a.choices === b.choices;
      const sameOperators = a.operators === b.operators;
      let code = '';
      let severity: ContentFinding['severity'] = 'warning';
      if (a.stem === b.stem && sameCode && sameOperators) {
        code = 'exact-duplicate';
        severity = 'blocking';
      } else if (
        (lexical >= 0.8 || (contained && lexical >= 0.6)) &&
        sameCode &&
        sameChoices &&
        sameOperators
      ) {
        code = 'near-identical';
        severity = 'blocking';
      } else if (
        a.code &&
        a.shape === b.shape &&
        lexical >= 0.65 &&
        sameChoices &&
        sameOperators
      ) {
        code = 'code-duplicate';
        severity = 'blocking';
      } else if (left.conceptId && left.conceptId === right.conceptId) {
        code = 'same-concept';
      } else if (
        lexical >= 0.65 ||
        (a.code && a.shape === b.shape && lexical >= 0.4)
      ) {
        code = 'lexical-near-duplicate';
      }
      if (code)
        findings.push({
          code,
          category: 'duplicate',
          severity,
          questionIds: [left.id, right.id],
          message: `${severity === 'blocking' ? 'Duplicate / Near-duplicate' : 'Review possible duplicate'} ${left.id} / ${right.id}: ${code} (lexical overlap ${lexical.toFixed(2)}).`,
        });
    }
  }
  return findings;
}

export function nearDuplicates(questions: Question[]): [string, string][] {
  return duplicateFindings(questions).map((finding) => [
    finding.questionIds[0],
    finding.questionIds[1],
  ]);
}

export function qualityFindings(questions: Question[]): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const warn = (code: string, ids: string[], message: string) =>
    findings.push({
      code,
      category: 'quality',
      severity: 'warning',
      questionIds: ids,
      message,
    });
  const openings = new Map<string, string[]>();
  const positions = new Map<number, string[]>();
  for (const q of questions) {
    const stem = q.question;
    const opening = normalizedQuestion(stem).split(' ').slice(0, 5).join(' ');
    openings.set(opening, [...(openings.get(opening) ?? []), q.id]);
    if (stem.split(/\s+/).length > 160)
      warn(
        'long-scenario',
        [q.id],
        'Scenario exceeds 160 words; check whether every constraint is necessary.',
      );
    if (/\b(?:not|except|least likely|incorrect)\b/i.test(stem))
      warn(
        'negative-wording',
        [q.id],
        'Review negative wording; prefer a positive, unambiguous task.',
      );
    if (
      /\b(?:always|never|guarantees?|unlimited|every possible)\b/i.test(
        [
          stem,
          ...q.answerChoices.map((c) => c.text),
          q.explanation,
          q.deepExplanation,
          ...Object.values(q.whyOtherAnswersAreWrong),
        ].join(' '),
      )
    )
      warn(
        'absolute-wording',
        [q.id],
        'Check absolute claims against documented limitations, including distractors.',
      );
    if (/\b(?:it|they|this|that)\b/i.test(stem))
      warn(
        'pronoun-review',
        [q.id],
        'Check pronoun references; this heuristic does not establish ambiguity.',
      );
    if (q.complexity !== 'concept-recall' && stem.split(/\s+/).length < 25)
      warn(
        'scenario-constraints',
        [q.id],
        'Short applied scenario: independently check prerequisites and constraints.',
      );
    const longestWrong = Math.max(
      ...q.answerChoices
        .filter((c) => !q.correctAnswer.includes(c.id))
        .map((c) => c.text.length),
    );
    if (
      q.answerChoices.some(
        (c) =>
          q.correctAnswer.includes(c.id) &&
          c.text.length > Math.max(50, longestWrong * 1.8),
      )
    )
      warn(
        'answer-length-cue',
        [q.id],
        'A correct option is substantially longer than all distractors.',
      );
    if (
      q.answerChoices.some((c) =>
        /^(?:all|none) of (?:the )?above\b|\b(?:obviously|magically)\b/i.test(
          c.text,
        ),
      )
    )
      warn(
        'distractor-cue',
        [q.id],
        'Review conspicuous distractors and all/none-of-the-above shortcuts.',
      );
    if (/\b(?:a|an)\s*\?$/i.test(stem))
      warn(
        'grammar-cue',
        [q.id],
        'Check whether article agreement gives away the answer.',
      );
    if (q.questionType === 'multi-select') {
      const declared = stem
        .match(/\b(?:choose|select)\s+(\d+|two|three|four|five)\b/i)?.[1]
        ?.toLowerCase();
      const number = declared
        ? Number(declared) || { two: 2, three: 3, four: 4, five: 5 }[declared]
        : undefined;
      if (number && number !== q.correctAnswer.length)
        warn(
          'selection-count',
          [q.id],
          'The written selection count disagrees with the correct answer count.',
        );
    }
    if (q.correctAnswer.length === 1) {
      const position =
        q.answerChoices.findIndex((c) => c.id === q.correctAnswer[0]) + 1;
      positions.set(position, [...(positions.get(position) ?? []), q.id]);
    }
  }
  for (const [opening, ids] of openings)
    if (ids.length >= 4)
      warn(
        'repeated-opening',
        ids,
        `Repeated opening (${ids.length}): "${opening}".`,
      );
  const singleCount = [...positions.values()].reduce(
    (sum, ids) => sum + ids.length,
    0,
  );
  for (const [position, ids] of positions)
    if (singleCount >= 8 && ids.length / singleCount > 0.55)
      warn(
        'answer-position-bias',
        ids,
        `Position ${position} holds ${ids.length}/${singleCount} single-answer keys before gameplay shuffling.`,
      );
  return findings;
}
