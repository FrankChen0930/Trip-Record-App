import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

// 卡片表面 primitive。預設帶內距，可用 padded={false} 關閉（例如要放滿版封面圖時）。
export function Card({ padded = true, className = '', style, ...rest }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: padded ? '16px 18px' : undefined,
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    />
  );
}
