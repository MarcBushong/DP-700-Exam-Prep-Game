import type { Reaction } from './reactions';

export function HostReaction({ reaction }: { reaction: Reaction | null }) {
  if (!reaction) return null;
  return (
    <p
      className="banter"
      aria-live="off"
      data-reaction-id={reaction.id}
      data-reaction-category={reaction.category}
      data-reaction-theme={reaction.themes.join(' ')}
      data-reaction-opening={reaction.opening}
      data-personality="flavor"
    >
      {reaction.renderedText}
    </p>
  );
}
