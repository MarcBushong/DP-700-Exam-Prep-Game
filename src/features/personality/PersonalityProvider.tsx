import { useState, type ReactNode } from 'react';
import { PersonalityContext, ReactionSessions } from './context';

export function PersonalityProvider({ children }: { children: ReactNode }) {
  const [sessions] = useState(() => new ReactionSessions());
  return (
    <PersonalityContext.Provider value={sessions}>
      {children}
    </PersonalityContext.Provider>
  );
}
