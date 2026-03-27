/**
 * Author: Leonardo Rodriguez
 *
 * Description:
 * React TextArea component for interactive Astro islands.
 * Supports label, error, helper text, character count, and design tokens.
 * Mobile-first responsive from 320px.
 *
 * @param label - Optional label text
 * @param name - TextArea name attribute (required)
 * @param helperText - Optional helper text below textarea
 * @param error - Error message string
 * @param maxLength - Optional max character count
 * @param showCount - Show character counter (default: false)
 * @returns React TextArea element
 */

import { useState } from "react";

interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  label?: string;
  name: string;
  helperText?: string;
  error?: string;
  showCount?: boolean;
}

export default function TextArea({
  label,
  name,
  placeholder = "",
  value,
  required = false,
  error = "",
  helperText = "",
  disabled = false,
  maxLength,
  showCount = false,
  rows = 4,
  className = "",
  onChange,
  ...props
}: TextAreaProps) {
  const [internalValue, setInternalValue] = useState(
    typeof value === "string" ? value : ""
  );
  const isControlled = value !== undefined;
  const currentValue = isControlled ? String(value) : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  const textareaClasses = [
    "block w-full px-3 py-2 border rounded-md shadow-sm text-sm resize-y",
    "focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500",
    "transition-colors duration-200",
    error ? "border-warning-500" : "border-neutral-300",
    disabled ? "bg-neutral-50 cursor-not-allowed opacity-60" : "bg-white",
    className,
  ].join(" ");

  return (
    <div className="mb-4 w-full">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium mb-1 text-gray-700">
          {label} {required && <span className="text-warning-500">*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        placeholder={placeholder}
        value={currentValue}
        className={textareaClasses}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        onChange={handleChange}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : helperText ? `${name}-helper` : undefined}
        {...props}
      />
      <div className="flex justify-between items-center mt-1">
        <div>
          {error && (
            <p id={`${name}-error`} className="pl-1 text-xs text-warning-500" role="alert">
              {error}
            </p>
          )}
          {!error && helperText && (
            <p id={`${name}-helper`} className="pl-1 text-xs text-neutral-400">
              {helperText}
            </p>
          )}
        </div>
        {showCount && maxLength && (
          <span className={`text-xs ${currentValue.length >= maxLength ? "text-warning-500" : "text-neutral-400"}`}>
            {currentValue.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
