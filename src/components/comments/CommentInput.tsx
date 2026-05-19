/**
 * @file CommentInput.tsx
 * @description Input field for composing comments with editorial design
 */

import React from 'react';

interface CommentInputProps {
    id: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function CommentInput({
                                         id,
                                         value,
                                         onChange,
                                         onKeyDown,
                                         placeholder = 'Escribe tu comentario... (Enter para enviar)',
                                         disabled = false,
                                     }: CommentInputProps): React.ReactElement {
    return (
        <input
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className="
        max-w-full border border-neutral-300 rounded-lg
        bg-surface-white text-ink placeholder:text-ink-muted
        focus:outline-none focus:ring-2 focus:ring-primary-500
        focus:border-primary-500 transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        border-t mb-4 mt-0 py-3 px-4 mx-6
        "
        />
    );
}

