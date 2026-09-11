import { useOutletContext } from 'react-router-dom';

export interface QuestionFlagContext {
  flagged: boolean;
  setFlagged: (flagged: boolean) => void;
}

export function useQuestionFlag() {
  return useOutletContext<QuestionFlagContext>();
}
