/**
 * @file CommentMessage.tsx
 * @description Individual comment message component with editorial design
 */

import React from 'react';

interface CommentMessageProps {
  time: string;
  children: React.ReactNode;
}

export default function CommentMessage({ time, children }: CommentMessageProps): React.ReactElement {
  return (
    <div className="flex w-max max-w-full shrink-0 flex-col gap-1">
      <div className="max-w-[min(100%,28rem)] rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
        <p className="text-left text-sm leading-relaxed text-ink wrap-break-word whitespace-pre-wrap">
          {children}
        </p>
      </div>
      <span className="text-xs text-ink-muted">{time}</span>
    </div>
  );
}

