import type { HTMLAttributes, CSSProperties } from 'react';

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

// 標籤 / pill primitive。輕量底 + 同色系深字，符合設計系統規範。
const toneStyle: Record<Tone, CSSProperties> = {
  brand: { background: 'var(--color-primary-soft)', color: 'var(--color-primary-strong)' },
  neutral: { background: '#EEF1F0', color: '#4A5551' },
  success: { background: '#DCF5E8', color: '#0F6E56' },
  warning: { background: '#FCEFD6', color: '#8A5A00' },
  danger: { background: '#FBE3E3', color: '#9B2A2A' },
};

export function Badge({ tone = 'brand', className = '', style, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.4,
        padding: '3px 9px',
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        ...toneStyle[tone],
        ...style,
      }}
      {...rest}
    />
  );
}
