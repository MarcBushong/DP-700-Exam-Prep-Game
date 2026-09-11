import { useContext, useEffect, useState } from 'react';
import { useGame } from '../quiz/context';
import type { ReactionCategory } from './catalog';
import { PersonalityContext } from './context';
import {
  allowsReaction,
  readBanterLevel,
  type Reaction,
  type ReactionContext,
  type ReactionSurface,
} from './reactions';

export function useReaction(
  scope: string,
  eventId: string,
  categories: readonly ReactionCategory[],
  context: ReactionContext = {},
  surface: ReactionSurface = 'context',
  enabled = true,
): Reaction | null {
  const sessions = useContext(PersonalityContext);
  const { preferences } = useGame();
  const level = readBanterLevel(preferences);
  const [result, setResult] = useState<{
    key: string;
    reaction: Reaction | null;
  } | null>(null);
  const request = JSON.stringify({
    scope,
    eventId,
    categories,
    context,
    surface,
    level,
    enabled,
  });
  useEffect(() => {
    if (!sessions) return;
    const input: {
      scope: string;
      eventId: string;
      categories: ReactionCategory[];
      context: ReactionContext;
      surface: ReactionSurface;
      level: typeof level;
      enabled: boolean;
    } = JSON.parse(request);
    if (
      !input.enabled ||
      !allowsReaction(input.level, input.surface, input.context)
    )
      return;
    // Effects, not renders, consume events. The event cache makes StrictMode replay idempotent.
    const reaction = sessions
      .get(input.scope)
      .react(
        input.eventId,
        input.categories,
        input.context,
        input.level,
        input.surface,
      );
    setResult({ key: request, reaction });
  }, [request, sessions]);
  return enabled &&
    allowsReaction(level, surface, context) &&
    result?.key === request
    ? result.reaction
    : null;
}
