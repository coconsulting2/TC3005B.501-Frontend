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
    <div className="flex flex-col gap-1">
      <div className="max-w-xs lg:max-w-md px-4 py-3 bg-primary-50 border border-primary-200 rounded-lg">
        <p className="text-sm text-ink leading-relaxed">{children}</p>
      </div>
      <span className="text-xs text-ink-muted px-4">{time}</span>
    </div>
  );
}

