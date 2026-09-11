import { useMemo, type ReactNode } from 'react';
import { PersonalityContext, ReactionSessions } from './context';
import { mergeCatalog, reactionCatalog, type ReactionMessage } from './catalog';
import type { ReactionOptions } from './reactions';

const noExtensions: readonly unknown[] = [];
const defaultOptions: ReactionOptions = {};

export function PersonalityProvider({
  children,
  catalog = reactionCatalog,
  extensions = noExtensions,
  options = defaultOptions,
}: {
  children: ReactNode;
  catalog?: readonly ReactionMessage[];
  extensions?: readonly unknown[];
  options?: ReactionOptions;
}) {
  const sessions = useMemo(
    () => new ReactionSessions(mergeCatalog(catalog, extensions), options),
    [catalog, extensions, options],
  );
  return (
    <PersonalityContext.Provider value={sessions}>
      {children}
    </PersonalityContext.Provider>
  );
}
