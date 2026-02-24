'use client';

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
}

const baseInputClasses = [
  'block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400',
  'transition-colors duration-150',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
  'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
].join(' ');

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = '', ...rest },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const borderClass = error ? 'border-red-400' : 'border-gray-300';

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`${baseInputClasses} ${borderClass} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, rows = 4, className = '', ...rest },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const borderClass = error ? 'border-red-400' : 'border-gray-300';

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`${baseInputClasses} ${borderClass} resize-none ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
});
