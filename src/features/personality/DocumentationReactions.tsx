import { useState, type ReactNode } from 'react';
import { HostReaction } from './HostReaction';
import { useReaction } from './useReaction';

export function DocumentationReactions({
  scope,
  children,
}: {
  scope: string;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState('');
  const reaction = useReaction(
    scope,
    `documentation:${opened}`,
    ['documentation'],
    {},
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
