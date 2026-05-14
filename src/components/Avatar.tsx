/**
 * @file Avatar.tsx
 * @description Simple avatar component for displaying user initials
 */

import React from 'react';

interface AvatarProps {
  name?: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Avatar({ name = 'U', role, size = 'md' }: AvatarProps): React.ReactElement {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const initials = name
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-primary-100 text-primary-600 font-semibold border border-primary-200`}
      title={role ? `${name} - ${role}` : name}
    >
      {initials}
    </div>
  );
}

