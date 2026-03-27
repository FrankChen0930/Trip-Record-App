'use client';

import { useEffect, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function Modal({ isOpen, onClose, children, title }: ModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`modal-overlay ${isAnimating ? 'modal-overlay-visible' : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        className={`modal-content ${isAnimating ? 'modal-content-visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-2xl font-black mb-8 tracking-tighter italic">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
