import questionData from '../../data/questions.json';
import manifestData from '../../data/grounding-manifest.json';
import taxonomyData from '../../data/objectives.json';
import { validateContent } from './schema';

// Invalid or uncited content fails closed before the quiz can mount.
export const content = validateContent(
  questionData,
  manifestData,
  taxonomyData,
);
