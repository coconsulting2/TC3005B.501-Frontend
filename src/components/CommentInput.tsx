/**
 * @file CommentInput.tsx
 * @description Input field for composing comments with editorial design
 */

import React from 'react';

interface CommentInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CommentInput({
  value,
  onChange,
  onKeyDown,
  placeholder = 'Escribe tu comentario... (Enter para enviar)',
  disabled = false,
}: CommentInputProps): React.ReactElement {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-4 py-3 border border-neutral-300 rounded-lg bg-surface-white text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

