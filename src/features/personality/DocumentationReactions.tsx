import { useState, type ReactNode } from 'react';
import { HostReaction } from './HostReaction';
import { useReaction } from './useReaction';
import type { ReactionContext } from './reactions';

export function DocumentationReactions({
  scope,
  children,
  context = {},
}: {
  scope: string;
  children: ReactNode;
  context?: ReactionContext;
}) {
  const [opened, setOpened] = useState('');
  const reaction = useReaction(
    scope,
    `documentation:${opened}`,
    ['tome-opened', 'documentation'],
    context,
    'context',
    Boolean(opened),
  );
  return (
    <div
      onClickCapture={(event) => {
        if (!(event.target instanceof Element)) return;
        const link = event.target.closest('a.learn-link');
        if (link) setOpened(link.getAttribute('href') ?? '');
      }}
    >
      {children}
      <HostReaction reaction={reaction} />
    </div>
  );
}
