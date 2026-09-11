import questionData from '../../data/questions.json';
import manifestData from '../../data/grounding-manifest.json';
import taxonomyData from '../../data/objectives.json';
import { validateContent } from './schema';

// Invalid citations fail closed; nonverified/stale candidates remain reportable, not playable.
export const content = validateContent(
  questionData,
  manifestData,
  taxonomyData,
);
