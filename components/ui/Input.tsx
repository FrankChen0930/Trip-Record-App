import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

// 文字輸入 primitive。聚焦時以主色描邊。
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', style, onFocus, onBlur, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full outline-none transition-colors ${className}`}
        style={{
          height: 38,
          padding: '0 12px',
          fontSize: 14,
          color: 'var(--color-ink)',
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-border-hairline)',
          borderRadius: 'var(--radius-control)',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-primary)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-soft)';
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-hairline)';
          e.currentTarget.style.boxShadow = 'none';
          onBlur?.(e);
        }}
        {...rest}
      />
    );
  }
);
