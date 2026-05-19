/**
 * @file CommentLoading.tsx
 * @description Loading skeleton component for comments
 */

import React from 'react';

export default function CommentLoading(): React.ReactElement {
  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <div className="w-24 h-4 bg-neutral-200 rounded animate-pulse" />
            <div className="w-16 h-4 bg-neutral-200 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="max-w-xs h-12 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="max-w-xs h-3 bg-neutral-200 rounded animate-pulse w-20" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-row-reverse">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
        <div className="flex-1 space-y-3 items-end flex flex-col">
          <div className="space-y-2">
            <div className="max-w-xs h-12 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="max-w-xs h-3 bg-neutral-200 rounded animate-pulse w-20" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <div className="w-24 h-4 bg-neutral-200 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="max-w-xs h-16 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="max-w-xs h-3 bg-neutral-200 rounded animate-pulse w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

