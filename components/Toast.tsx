'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';

// ===== Toast 型別 =====
interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastItem['type'], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

// ===== Toast Provider =====
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastItem['type'] = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastBubble key={t.id} item={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ===== 單一 Toast 氣泡 =====
function ToastBubble({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onRemove(item.id), 400);
    }, item.duration || 3000);
    return () => clearTimeout(timer);
  }, [item, onRemove]);

  const icons: Record<string, string> = {
    success: '✓', error: '✕', info: 'ℹ', warning: '⚠'
  };

  const colors: Record<string, string> = {
    success: 'toast-success',
    error: 'toast-error',
    info: 'toast-info',
    warning: 'toast-warning'
  };

  return (
    <div className={`toast-bubble ${colors[item.type]} ${isVisible && !isLeaving ? 'toast-enter' : ''} ${isLeaving ? 'toast-leave' : ''}`}>
      <span className="toast-icon">{icons[item.type]}</span>
      <span className="toast-message">{item.message}</span>
      <button onClick={() => { setIsLeaving(true); setTimeout(() => onRemove(item.id), 400); }} className="toast-close">✕</button>
    </div>
  );
}
