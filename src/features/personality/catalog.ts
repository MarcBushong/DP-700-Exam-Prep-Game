export { banterLevels, type BanterLevel } from '../quiz/types';
export const reactionCatalogVersion = 1;
export type ReactionCategory =
  | 'correct'
  | 'incorrect'
  | 'partial'
  | 'unanswered'
  | 'time-expired'
  | 'streak'
  | 'broken-streak'
  | 'domain-perfect'
  | 'domain-strong'
  | 'domain-weak'
  | 'improved'
  | 'repeated-mistake'
  | 'session-complete'
  | 'score-high'
  | 'score-medium'
  | 'score-low'
  | 'expert-correct'
  | 'expert-miss'
  | 'documentation'
  | 'retry'
  | 'weak-practice'
  | 'returning'
  | 'start';

export interface ReactionMessage {
  id: string;
  category: ReactionCategory;
  tone: 'warm' | 'dry' | 'celebratory';
  intensity: 1 | 2 | 3;
  applicableDomains: string[];
  applicableDifficulties: string[];
  minimumStreak: number;
  maximumStreak: number | null;
  themes: string[];
  opening: string;
  text: string;
  reducedBanterText: string;
}

type Line = readonly [theme: string, text: string, reduced: string];
type ContextMetadata = Partial<
  Pick<
    ReactionMessage,
    | 'applicableDomains'
    | 'applicableDifficulties'
    | 'minimumStreak'
    | 'maximumStreak'
  >
>;

// Append rather than reorder: IDs are stable within this versioned catalog.
function pool(
  category: ReactionCategory,
  lines: Line[],
  metadata: ContextMetadata = {},
): ReactionMessage[] {
  return lines.map(([theme, text, reducedBanterText], index) => ({
    id: `${category}-${metadata.applicableDomains?.join('-') ?? 'general'}-${index + 1}`,
    category,
    tone:
      category === 'correct' || category === 'streak' ? 'celebratory' : 'dry',
    intensity: category === 'expert-correct' || category === 'streak' ? 3 : 2,
    applicableDomains: [],
    applicableDifficulties: [],
    minimumStreak: 0,
    maximumStreak: null,
    ...metadata,
    themes: [theme],
    opening: text.split(/[\s.,!?—:]+/)[0].toLowerCase(),
    text,
    reducedBanterText,
  }));
}

export const reactionCatalog: readonly ReactionMessage[] = [
  ...pool('correct', [
    [
      'architecture',
      'Nicely reasoned. The whiteboard gets to keep its dignity.',
      'Nicely reasoned.',
    ],
    [
      'documentation',
      'Evidence wins. The footnotes are quietly applauding.',
      'Good use of the evidence.',
    ],
    [
      'pipelines',
      'Clean finish. No dramatic status meeting required.',
      'A clean finish.',
    ],
    ['monitoring', 'Green looks good on this answer.', 'Good work.'],
    [
      'governance',
      'Approved by the imaginary committee for sensible decisions.',
      'A sound decision.',
    ],
    [
      'troubleshooting',
      'Mystery solved, without a six-part incident series.',
      'Well worked out.',
    ],
    [
      'SQL',
      'Precisely chosen. Even the punctuation looks pleased.',
      'Precisely chosen.',
    ],
    [
      'Spark',
      'Bright result. The study notebook gets a gold star.',
      'A bright result.',
    ],
    [
      'OneLake',
      'Solid connection. The learning map has one fewer question mark.',
      'A solid connection.',
    ],
    [
      'KQL',
      'Sharp reading. The clues did not stand a chance.',
      'Sharp reading.',
    ],
    [
      'lakehouse',
      'Another brick in your understanding, correctly placed.',
      'Another useful connection.',
    ],
    [
      'eventstreams',
      'Momentum acquired. Please keep hands inside the study session.',
      'Keep that momentum.',
    ],
    [
      'architecture',
      'Right choice. The design review can end before lunch.',
      'The right choice.',
    ],
    [
      'documentation',
      'Specifics noticed. That is where the interesting bits live.',
      'Good attention to specifics.',
    ],
    [
      'pipelines',
      'Onward, with one less detour on the learning route.',
      'Onward.',
    ],
    [
      'monitoring',
      'Looking good. The imaginary dashboard has nothing to add.',
      'Looking good.',
    ],
    [
      'governance',
      'Careful reasoning beats a confident guess. Very unglamorous. Very effective.',
      'Careful reasoning pays off.',
    ],
    [
      'troubleshooting',
      'Puzzle handled. The red herring is taking a personal day.',
      'Well handled.',
    ],
    [
      'SQL',
      'Exactly. A small word doing a satisfying amount of work.',
      'Exactly.',
    ],
    ['Spark', 'Good call. Your notebook may underline that one.', 'Good call.'],
    [
      'OneLake',
      'Connected the dots, without needing a bigger diagram.',
      'The dots are connecting.',
    ],
    [
      'KQL',
      'Well spotted. A detail tried to sneak by and failed.',
      'Well spotted.',
    ],
    [
      'lakehouse',
      'Foundation strengthened. No ceremonial ribbon needed.',
      'A stronger foundation.',
    ],
    [
      'eventstreams',
      'Keep going. The next question has been put on notice.',
      'Keep going.',
    ],
    [
      'architecture',
      'Thoughtful choice. The tradeoff has met its match.',
      'A thoughtful choice.',
    ],
    [
      'documentation',
      'Reading carefully remains a surprisingly good strategy.',
      'Careful reading helps.',
    ],
    [
      'pipelines',
      'Smooth landing. The checklist is enjoying its quiet moment.',
      'A smooth finish.',
    ],
    ['monitoring', 'Signal found. The noise can wait outside.', 'Good focus.'],
    [
      'governance',
      'Consider that decision filed under “well supported.”',
      'Well supported.',
    ],
    [
      'troubleshooting',
      'Resolved. No heroic late-night montage necessary.',
      'Well resolved.',
    ],
  ]),
  ...pool('incorrect', [
    [
      'architecture',
      'Not this design. The whiteboard still has room for a revision.',
      'A useful point to revisit.',
    ],
    [
      'documentation',
      'Evidence check time. The explanation below has the useful distinction.',
      'Check the distinction below.',
    ],
    [
      'pipelines',
      'Small detour. This is an excellent place to take it: practice.',
      'A safe place to learn.',
    ],
    [
      'monitoring',
      'Signal received: one topic deserves another look.',
      'One topic to revisit.',
    ],
    [
      'governance',
      'Revision requested. Happily, there is no approval queue here.',
      'You can build on this.',
    ],
    [
      'troubleshooting',
      'Plot adjustment. The investigation continues below.',
      'The explanation can help.',
    ],
    [
      'SQL',
      'Close the guesswork tab; open the reasoning one.',
      'Try comparing the requirements.',
    ],
    [
      'Spark',
      'Notebook moment. Save the distinction, not the disappointment.',
      'Keep the useful distinction.',
    ],
    [
      'OneLake',
      'Another connection to make. No rush on the learning map.',
      'Take your time with this one.',
    ],
    [
      'KQL',
      'Clue worth keeping: why the alternatives differ.',
      'Look for the deciding clue.',
    ],
    [
      'lakehouse',
      'Found a gap in the foundation. Practice is where repairs belong.',
      'A chance to strengthen the basics.',
    ],
    [
      'eventstreams',
      'Pause the momentum briefly; understanding gets right of way.',
      'Pause and review.',
    ],
    [
      'architecture',
      'Back to the requirements, not back to square one.',
      'This is still progress.',
    ],
    [
      'documentation',
      'Details have opinions. The documentation explains them below.',
      'The details matter here.',
    ],
    [
      'pipelines',
      'Learning route recalculated. Your progress has not been deleted.',
      'Keep moving forward.',
    ],
    [
      'monitoring',
      'Useful feedback, even if it arrived without confetti.',
      'Useful feedback for next time.',
    ],
    [
      'governance',
      'Consider this a draft answer with helpful review comments.',
      'Use the review to refine your choice.',
    ],
    [
      'troubleshooting',
      'A plausible distractor did its job. Now we examine its paperwork.',
      'Compare the alternatives below.',
    ],
    [
      'SQL',
      'One distinction missed, one distinction available to learn.',
      'One distinction to learn.',
    ],
    [
      'Spark',
      'Next attempt gets the benefit of this explanation.',
      'This helps the next attempt.',
    ],
    [
      'OneLake',
      'Map updated: here is a spot to explore again.',
      'A useful spot on your study map.',
    ],
    [
      'KQL',
      'Worth investigating. The best clue is usually a requirement.',
      'Recheck the requirements.',
    ],
    [
      'lakehouse',
      'Room for another layer of understanding.',
      'Build one layer at a time.',
    ],
    [
      'eventstreams',
      'Take a breath. The question is practice, not a pager alert.',
      'Take a breath and review.',
    ],
    [
      'architecture',
      'Tradeoffs can be sneaky. Let’s make this one less so.',
      'Make the tradeoff explicit.',
    ],
    [
      'documentation',
      'Good opportunity for a very small, very targeted reading break.',
      'A short review may help.',
    ],
    [
      'pipelines',
      'Try the explanation before trying to negotiate with the score.',
      'Focus on the explanation.',
    ],
    [
      'monitoring',
      'Today’s feedback is tomorrow’s familiar detail.',
      'This can become familiar.',
    ],
    [
      'governance',
      'Question reviewed. Confidence can return with better evidence.',
      'Use evidence to rebuild confidence.',
    ],
    [
      'troubleshooting',
      'Nothing broken here except a guess. Those are replaceable.',
      'A new attempt is always possible.',
    ],
  ]),
  ...pool(
    'streak',
    [
      [
        'monitoring',
        'Steady signal: {streak} correct in a row.',
        'A steady streak of {streak}.',
      ],
      [
        'architecture',
        'A {streak}-answer streak. The whiteboard is running out of compliments.',
        '{streak} correct in a row.',
      ],
      [
        'documentation',
        'Evidence of a streak: {streak} consecutive correct answers.',
        'Nice consistency: {streak} in a row.',
      ],
      [
        'pipelines',
        'Momentum report: {streak} correct, no meeting attached.',
        'Good momentum at {streak}.',
      ],
      [
        'governance',
        'Officially unofficial streak count: {streak}.',
        'A streak of {streak}.',
      ],
      [
        'Spark',
        'Bright run: {streak} answers connected.',
        '{streak} answers connected.',
      ],
      [
        'SQL',
        'Count confirmed: {streak}. We resisted making a spreadsheet.',
        '{streak} consecutive correct answers.',
      ],
      [
        'KQL',
        'Pattern spotted: you, answering correctly, {streak} times running.',
        'A consistent run of {streak}.',
      ],
      [
        'OneLake',
        'Connected knowledge, {streak} questions deep.',
        '{streak} good connections.',
      ],
      [
        'lakehouse',
        'Building steadily: {streak} correct in succession.',
        'Steady work: {streak} correct.',
      ],
      [
        'troubleshooting',
        'Mysteries resolved consecutively: {streak}. Detective hat optional.',
        'Well worked out, {streak} times.',
      ],
      [
        'eventstreams',
        'Rolling along at {streak} correct. Understanding still beats speed.',
        'Keep your pace at {streak}.',
      ],
      [
        'architecture',
        'Stacking up good decisions: {streak} so far.',
        '{streak} sound decisions.',
      ],
      [
        'documentation',
        'Footnote to this streak: {streak} correct, earned one at a time.',
        '{streak}, one at a time.',
      ],
      [
        'monitoring',
        'Looking consistent: {streak} in a row in this sample.',
        'Good consistency in this sample.',
      ],
    ],
    { minimumStreak: 3 },
  ),
  ...pool('time-expired', [
    [
      'monitoring',
      'Clock stopped. Curiosity does not have to.',
      'There is still time to learn.',
    ],
    [
      'documentation',
      'Time for the explanation, without the countdown.',
      'Review at your own pace.',
    ],
    [
      'pipelines',
      'Pace adjustment available: untimed practice is a perfectly good route.',
      'Untimed practice is an option.',
    ],
    [
      'architecture',
      'Deadline met the wall. Understanding can take the scenic route.',
      'Understanding can take longer.',
    ],
    [
      'governance',
      'No appeal needed. You can practice this topic again without a timer.',
      'Try this topic again.',
    ],
    [
      'troubleshooting',
      'Pause here. The answer review is not on call.',
      'Take time with the review.',
    ],
    [
      'SQL',
      'Seconds ran out; learning opportunities did not.',
      'A chance to review remains.',
    ],
    [
      'Spark',
      'Notebook stays open after the clock closes.',
      'Keep the learning going.',
    ],
    [
      'OneLake',
      'Another lap is available, ideally with less clock-watching.',
      'Another attempt is available.',
    ],
    [
      'KQL',
      'Clues remain below, even after the buzzer.',
      'The explanation is still useful.',
    ],
    [
      'lakehouse',
      'Slow foundations are still foundations. Review first.',
      'Build understanding first.',
    ],
    [
      'eventstreams',
      'Breathing room restored. Read the explanation at human speed.',
      'Read at a comfortable pace.',
    ],
    [
      'monitoring',
      'Timer complete; study plan still in progress.',
      'Your study can continue.',
    ],
    [
      'documentation',
      'Good moment for a reading break with no ticking soundtrack.',
      'A quiet review may help.',
    ],
    [
      'architecture',
      'Next design choice: perhaps a longer timer.',
      'You can adjust the timer.',
    ],
  ]),
  ...pool('session-complete', [
    [
      'architecture',
      'Session wrapped. The whiteboard has earned a break.',
      'A useful session completed.',
    ],
    [
      'documentation',
      'Learning logged. The reading list has the next chapter.',
      'Your next reading is ready.',
    ],
    [
      'pipelines',
      'One study run complete. No retrospective meeting required.',
      'One study run complete.',
    ],
    [
      'monitoring',
      'Results are in. Look for signals, not verdicts.',
      'Look for useful learning signals.',
    ],
    [
      'governance',
      'Review ready. Your next step is yours to choose.',
      'Choose your next step.',
    ],
    [
      'troubleshooting',
      'Investigation complete for now. A few clues can come with you.',
      'Take the useful clues forward.',
    ],
    [
      'SQL',
      'Counted, scored, and ready to learn from.',
      'Ready to learn from this result.',
    ],
    [
      'Spark',
      'Notebook checkpoint reached. Stretching is permitted.',
      'A good point for a break.',
    ],
    [
      'OneLake',
      'Connections made. The map below shows where to go next.',
      'Use the map for your next step.',
    ],
    [
      'KQL',
      'Patterns worth examining, conveniently without a status call.',
      'Look for patterns below.',
    ],
    [
      'lakehouse',
      'Another layer of practice in place.',
      'Another layer of practice completed.',
    ],
    [
      'eventstreams',
      'Pause the flow. Give the review some room.',
      'Make room for review.',
    ],
    [
      'architecture',
      'A finished session, not a final verdict on your skills.',
      'This is a sample, not a verdict.',
    ],
    [
      'documentation',
      'Keep the lessons; leave the imaginary report card anxiety.',
      'Keep the useful lessons.',
    ],
    [
      'pipelines',
      'Route completed. Your next learning stop is on the map.',
      'Pick your next learning stop.',
    ],
    [
      'monitoring',
      'Useful numbers below. None of them measure your potential.',
      'Use these numbers to plan practice.',
    ],
    [
      'governance',
      'Consider this result a planning document, not a prophecy.',
      'Use the result to plan.',
    ],
    [
      'troubleshooting',
      'Good place to turn missed answers into future familiar faces.',
      'Revisit what felt unfamiliar.',
    ],
    [
      'SQL',
      'That is a wrap. The details are more useful than the headline.',
      'Look beyond the headline score.',
    ],
    [
      'Spark',
      'Progress checkpoint saved locally, dramatic music not included.',
      'A local progress checkpoint.',
    ],
  ]),
  ...pool('documentation', [
    [
      'documentation',
      'Primary sources: delightfully short on guesswork.',
      'Good to check the source.',
    ],
    [
      'architecture',
      'Evidence belongs in the design review. Nice invitation.',
      'Evidence helps with decisions.',
    ],
    [
      'pipelines',
      'Reading break approved, no scheduling meeting required.',
      'Take a useful reading break.',
    ],
    [
      'monitoring',
      'Specifics ahead. The signal-to-handwaving ratio looks promising.',
      'Look for the relevant specifics.',
    ],
    [
      'governance',
      'Trust, then read the supporting details.',
      'Check the supporting details.',
    ],
    [
      'troubleshooting',
      'Investigation upgraded from hunch to source material.',
      'A useful investigation step.',
    ],
    [
      'SQL',
      'Footnotes get their moment in the spotlight.',
      'The source can clarify this.',
    ],
    [
      'Spark',
      'Notebook open? This is a good place for a useful distinction.',
      'Keep the useful distinction.',
    ],
    [
      'OneLake',
      'Follow the evidence, not the loudest guess.',
      'Follow the evidence.',
    ],
    [
      'KQL',
      'Curiosity has selected a very practical next step.',
      'A practical next step.',
    ],
  ]),
  ...pool('weak-practice', [
    [
      'architecture',
      'Targeted practice. The whiteboard has circled the useful bits.',
      'Practice with a clear target.',
    ],
    [
      'documentation',
      'Reading meets another attempt. A sensible collaboration.',
      'Put your review into practice.',
    ],
    [
      'pipelines',
      'A shorter route to the topics that need another pass.',
      'Give these topics another pass.',
    ],
    [
      'monitoring',
      'Follow the learning signals, not the temptation to avoid them.',
      'Use the feedback to focus.',
    ],
    [
      'governance',
      'Practice priorities selected. No committee delay.',
      'Your practice priorities are set.',
    ],
    [
      'troubleshooting',
      'Back to the interesting puzzles, with better clues this time.',
      'Try again with what you learned.',
    ],
    [
      'SQL',
      'Specific gaps, specific practice. Refreshingly uncomplicated.',
      'Focus on specific gaps.',
    ],
    [
      'Spark',
      'Notebook rematch. Understanding gets the home advantage.',
      'Build on your review.',
    ],
    [
      'OneLake',
      'Reconnecting the dots that were a little far apart.',
      'Strengthen these connections.',
    ],
    [
      'lakehouse',
      'Reinforce the foundation, then build higher.',
      'Strengthen your foundation.',
    ],
  ]),
  ...pool('partial', [
    [
      'architecture',
      'Some pieces fit. Check the whole design before the next attempt.',
      'Review the complete set.',
    ],
    [
      'documentation',
      'A useful start. The exact answer set needs one more comparison.',
      'Compare every choice.',
    ],
    [
      'monitoring',
      'Partial signal found. This question still requires an exact match.',
      'Some correct choices identified.',
    ],
    [
      'troubleshooting',
      'Several clues collected; review the rest of the case.',
      'Finish comparing the clues.',
    ],
    [
      'pipelines',
      'Partway there is a learning step, even without partial credit.',
      'A useful learning step.',
    ],
  ]),
  ...pool('unanswered', [
    [
      'documentation',
      'Skipped, not banished. The explanation is ready when you are.',
      'Review when you are ready.',
    ],
    [
      'architecture',
      'A blank answer can still lead to a useful connection.',
      'A useful connection is still possible.',
    ],
    [
      'monitoring',
      'Noted for review. No dramatic red pen involved.',
      'Noted for review.',
    ],
    [
      'troubleshooting',
      'Save this puzzle for a calmer second look.',
      'Try a second look.',
    ],
  ]),
  ...pool('broken-streak', [
    [
      'architecture',
      'Streak paused. The understanding you built is still there.',
      'Your earlier learning still counts.',
    ],
    [
      'monitoring',
      'One miss does not erase a good run.',
      'One miss does not erase progress.',
    ],
    [
      'pipelines',
      'A detour after a good run. The route remains open.',
      'You can build another run.',
    ],
    [
      'documentation',
      'Streaks end; useful notes last longer.',
      'Keep the useful notes.',
    ],
  ]),
  ...pool('domain-perfect', [
    [
      'architecture',
      '{domain}: every sampled question correct. The whiteboard offers a quiet nod.',
      'Every sampled question correct in {domain}.',
    ],
    [
      'monitoring',
      'Clean sample in {domain}. Broader coverage is still worth a look.',
      'A clean sample in {domain}.',
    ],
    [
      'documentation',
      'All sampled answers matched in {domain}. Keep exploring beyond this set.',
      'Keep exploring {domain} beyond this sample.',
    ],
  ]),
  ...pool('domain-strong', [
    [
      'governance',
      'Solid sample in {domain}. No victory speech required.',
      'A solid sample in {domain}.',
    ],
    [
      'pipelines',
      '{domain} is moving along in this sample. Revisit the remaining gaps.',
      'Build on this {domain} sample.',
    ],
    [
      'architecture',
      'Strong showing in {domain}; the next blueprint can include the missed details.',
      'Review the missed details in {domain}.',
    ],
  ]),
  ...pool('domain-weak', [
    [
      'troubleshooting',
      '{domain} has volunteered for the next practice round.',
      'Revisit {domain} in practice.',
    ],
    [
      'documentation',
      'A reading-and-retry opportunity in {domain}, not a verdict.',
      'Review and retry {domain}.',
    ],
    [
      'lakehouse',
      'More foundation work in {domain} could be useful.',
      'Build more confidence in {domain}.',
    ],
  ]),
  ...pool('improved', [
    [
      'monitoring',
      'A recovery worth noticing. That feedback did not go to waste.',
      'Good recovery.',
    ],
    [
      'architecture',
      'Revised understanding, better result. A useful version upgrade.',
      'A useful improvement.',
    ],
    [
      'documentation',
      'Learning made visible. Keep the distinction that helped.',
      'Keep what helped.',
    ],
    [
      'pipelines',
      'Back on track, carrying something learned from the detour.',
      'Back on track.',
    ],
  ]),
  ...pool('repeated-mistake', [
    [
      'troubleshooting',
      'Familiar puzzle? Compare the deciding requirement before another attempt.',
      'Revisit the deciding requirement.',
    ],
    [
      'documentation',
      'This concept wants a closer read, not a faster retry.',
      'Try a closer read.',
    ],
    [
      'architecture',
      'Recurring gap spotted. One small diagram might help make it stick.',
      'Try a different study approach.',
    ],
    [
      'monitoring',
      'A repeated miss is a useful signal for focused practice.',
      'A useful focus for practice.',
    ],
  ]),
  ...pool('score-high', [
    [
      'architecture',
      'Strong sample. Leave some space on the map for untested topics.',
      'Strong sampled performance.',
    ],
    [
      'monitoring',
      'Looking strong here. A sample is still a sample, not an exam forecast.',
      'Keep broadening coverage.',
    ],
    [
      'governance',
      'Well-supported answers in this run. Certification predictions remain off the agenda.',
      'Build on this run.',
    ],
  ]),
  ...pool('score-medium', [
    [
      'pipelines',
      'Some smooth stretches, some detours. The next route is clearer now.',
      'The next steps are clearer.',
    ],
    [
      'documentation',
      'Useful connections made, useful reading still ahead.',
      'Keep the review focused.',
    ],
    [
      'architecture',
      'A working draft of understanding, with clear places to refine.',
      'Refine the gaps you found.',
    ],
  ]),
  ...pool('score-low', [
    [
      'troubleshooting',
      'A map of what to study next is a perfectly useful result.',
      'Use this as a study map.',
    ],
    [
      'lakehouse',
      'Foundation-building territory. Smaller, untimed sessions are welcome.',
      'Try smaller, focused sessions.',
    ],
    [
      'documentation',
      'More reading, another try. Neither needs a dramatic origin story.',
      'Review and try again.',
    ],
  ]),
  ...pool(
    'expert-correct',
    [
      [
        'architecture',
        'Expert-level puzzle handled. The imaginary design panel is taking notes.',
        'Well handled at Expert difficulty.',
      ],
      [
        'monitoring',
        'A demanding question, a solid answer. Quiet celebration authorized.',
        'A solid answer to a demanding question.',
      ],
      [
        'documentation',
        'Expert detail spotted. The footnotes feel seen.',
        'Good attention to Expert-level detail.',
      ],
      [
        'troubleshooting',
        'Hard puzzle solved without the dramatic detective soundtrack.',
        'A difficult puzzle worked out.',
      ],
    ],
    { applicableDifficulties: ['expert'] },
  ),
  ...pool(
    'expert-miss',
    [
      [
        'architecture',
        'Expert tradeoffs take practice. The design review below is a useful one.',
        'Take time with this Expert question.',
      ],
      [
        'documentation',
        'Demanding detail, useful explanation. No need to rush either.',
        'A useful detail to review.',
      ],
      [
        'monitoring',
        'Expert difficulty found a study target. That is useful feedback.',
        'A useful Expert-level study target.',
      ],
      [
        'troubleshooting',
        'Tough puzzle. The next attempt gets a better set of clues.',
        'Build on the clues below.',
      ],
    ],
    { applicableDifficulties: ['expert'] },
  ),
  ...pool('retry', [
    [
      'troubleshooting',
      'Rematch scheduled. Bring the explanation this time.',
      'Put the explanation into practice.',
    ],
    [
      'documentation',
      'Round two, now with supporting evidence.',
      'Try again with the evidence.',
    ],
    [
      'architecture',
      'Revision time. The first draft has served its purpose.',
      'Build on the first attempt.',
    ],
    [
      'pipelines',
      'Back through the tricky stretch, at your own pace.',
      'Revisit the tricky stretch.',
    ],
    [
      'monitoring',
      'Another attempt, a little more context. A sensible experiment.',
      'Another attempt with more context.',
    ],
  ]),
  ...pool('returning', [
    [
      'OneLake',
      'Welcome back. The learning map kept your place.',
      'Welcome back.',
    ],
    [
      'documentation',
      'Good to see another chapter in the study notebook.',
      'Ready for another chapter.',
    ],
    [
      'architecture',
      'Back at the whiteboard. The questions have behaved themselves.',
      'Good to see you again.',
    ],
    [
      'pipelines',
      'Another learning run? A very reasonable recurring appointment.',
      'Ready for another session.',
    ],
    [
      'monitoring',
      'Your local learning trail is ready for another data point.',
      'Your learning trail is here.',
    ],
  ]),
  ...pool('start', [
    [
      'architecture',
      'Requirements first, guesses second. The whiteboard is ready.',
      'Take your time with the requirements.',
    ],
    [
      'documentation',
      'A new session, with evidence waiting in the wings.',
      'A new chance to practice.',
    ],
    [
      'monitoring',
      'Practice underway. Curiosity is the only attendance requirement.',
      'Practice at your own pace.',
    ],
  ]),
  ...pool(
    'correct',
    [
      [
        'governance',
        '{skill}: a sound decision. The imaginary review board agrees.',
        'A sound decision in {skill}.',
      ],
    ],
    { applicableDomains: ['implement-and-manage-an-analytics-solution'] },
  ),
  ...pool(
    'correct',
    [
      [
        'pipelines',
        '{skill}: connected. The learning route has a little less traffic.',
        'A good connection in {skill}.',
      ],
    ],
    { applicableDomains: ['ingest-and-transform-data'] },
  ),
  ...pool(
    'correct',
    [
      [
        'monitoring',
        '{skill}: a useful signal, correctly read.',
        'Well read in {skill}.',
      ],
    ],
    { applicableDomains: ['monitor-and-optimize-an-analytics-solution'] },
  ),
  ...pool(
    'incorrect',
    [
      [
        'governance',
        '{domain}: one decision to revisit, no review committee required.',
        'Revisit this decision in {domain}.',
      ],
    ],
    { applicableDomains: ['implement-and-manage-an-analytics-solution'] },
  ),
  ...pool(
    'incorrect',
    [
      [
        'pipelines',
        '{domain}: a detour with an explanation attached.',
        'Review this step in {domain}.',
      ],
    ],
    { applicableDomains: ['ingest-and-transform-data'] },
  ),
  ...pool(
    'incorrect',
    [
      [
        'monitoring',
        '{domain}: practice has identified another useful signal.',
        'A useful review point in {domain}.',
      ],
    ],
    { applicableDomains: ['monitor-and-optimize-an-analytics-solution'] },
  ),
];
