import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// 設計系統 primitive — 湖水青旅。顏色走 CSS 變數，套版不受 Tailwind 設定影響。
const variantStyle: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--color-primary)', color: '#fff', border: '0.5px solid transparent' },
  secondary: { background: 'var(--color-surface)', color: 'var(--color-ink)', border: '0.5px solid var(--color-border-hairline)' },
  ghost: { background: 'transparent', color: 'var(--color-primary-strong)', border: '0.5px solid transparent' },
  danger: { background: 'var(--color-danger)', color: '#fff', border: '0.5px solid transparent' },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 13 },
  md: { padding: '9px 16px', fontSize: 14 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        borderRadius: 'var(--radius-control)',
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
      {...rest}
    />
  );
}
