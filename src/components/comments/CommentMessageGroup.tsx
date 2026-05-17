/**
 * @file CommentMessageGroup.tsx
 * @description Groups messages from the same sender with header and loading state
 */

import React from 'react';
import Avatar from './Avatar';

interface CommentMessageGroupProps {
  send: boolean;
  name: string;
  role?: string;
  loading?: boolean;
  children: React.ReactNode;
}

export default function CommentMessageGroup({
  send,
  name,
  role,
  loading = false,
  children,
}: CommentMessageGroupProps): React.ReactElement {
  return (
    <div className={`flex w-full min-w-0 gap-3 ${send ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="shrink-0 pt-1">
        <Avatar name={name} role={role} />
      </div>

      <div className={`flex min-w-0 flex-1 flex-col gap-2 overflow-hidden ${send ? 'items-end' : 'items-start'}`}>
        {!send && name && (
          <div className="flex max-w-full flex-wrap items-baseline gap-2 px-1">
            <span className="text-sm font-medium text-ink">{name}</span>
            {role && <span className="text-xs text-ink-muted uppercase tracking-wide">{role}</span>}
          </div>
        )}

        <div className={`flex w-full min-w-0 flex-col gap-2 ${send ? 'items-end' : 'items-start'}`}>
          {children}
        </div>

        {loading && (
          <div className="flex gap-1 px-4 py-2">
            <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

