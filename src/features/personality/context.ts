import { createContext } from 'react';
import { reactionCatalog, type ReactionMessage } from './catalog';
import { ReactionSession, type ReactionOptions } from './reactions';

export class ReactionSessions {
  private readonly sessions = new Map<
    string,
    {
      catalog: readonly ReactionMessage[];
      session: ReactionSession;
    }
  >();

  constructor(
    private readonly catalog: readonly ReactionMessage[] = reactionCatalog,
    private readonly options: ReactionOptions = {},
  ) {}

  get(
    scope: string,
    catalog: readonly ReactionMessage[] = this.catalog,
  ): ReactionSession {
    const existing = this.sessions.get(scope);
    if (existing?.catalog === catalog) return existing.session;
    const session = new ReactionSession(catalog, this.options);
    this.sessions.set(scope, { session, catalog });
    if (this.sessions.size > 32) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    return session;
  }
}

export const PersonalityContext = createContext<ReactionSessions | null>(null);
