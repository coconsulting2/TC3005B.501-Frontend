/**
 * Author: Leonardo Rodriguez
 *
 * Description:
 * React InputField component for interactive Astro islands.
 * Supports label, error message, helper text, and all standard input types.
 * Uses design tokens for consistent styling.
 *
 * @param label - Optional label text
 * @param name - Input name attribute (required)
 * @param helperText - Optional helper text below input
 * @param error - Error message string
 * @param type - Input type (text, email, tel, url, password, number, date)
 * @returns React InputField element
 */

import { useState } from "react";
import type { InputTypes } from "@type/input";
import { InputPatterns } from "@type/input";

interface InputFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  name: string;
  helperText?: string;
  error?: string;
  type?: InputTypes;
}

export default function InputField({
  label,
  name,
  placeholder = "",
  value,
  required = false,
  error = "",
  helperText = "",
  disabled = false,
  type = "text",
  pattern,
  className = "",
  onChange,
  ...props
}: InputFieldProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const finalPattern = pattern ?? InputPatterns[type];
  const isControlled = value !== undefined;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  const inputClasses = [
    "block w-full px-3 py-2 border rounded-md shadow-sm text-sm",
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
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={isControlled ? value : internalValue}
        className={inputClasses}
        required={required}
        disabled={disabled}
        pattern={finalPattern}
        onChange={handleChange}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : helperText ? `${name}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${name}-error`} className="pl-1 text-xs text-warning-500 mt-1" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${name}-helper`} className="pl-1 text-xs text-neutral-400 mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
