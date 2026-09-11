import { createContext } from 'react';
import { ReactionSession } from './reactions';

export class ReactionSessions {
  private readonly sessions = new Map<string, ReactionSession>();
  get(scope: string): ReactionSession {
    const existing = this.sessions.get(scope);
    if (existing) return existing;
    const session = new ReactionSession();
    this.sessions.set(scope, session);
    if (this.sessions.size > 8) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    return session;
  }
}

export const PersonalityContext = createContext<ReactionSessions | null>(null);
