'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';

interface ConfirmOptions {
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: () => Promise.resolve(false)
});
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: { message: '' },
    resolve: null,
  });

  const [isAnimating, setIsAnimating] = useState(false);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, options, resolve });
    });
  }, []);

  useEffect(() => {
    if (state.isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
    }
  }, [state.isOpen]);

  const handleResponse = (value: boolean) => {
    setIsAnimating(false);
    setTimeout(() => {
      state.resolve?.(value);
      setState(prev => ({ ...prev, isOpen: false, resolve: null }));
    }, 250);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.isOpen && (
        <div className={`modal-overlay ${isAnimating ? 'modal-overlay-visible' : ''}`} onClick={() => handleResponse(false)}>
          <div
            className={`confirm-dialog ${isAnimating ? 'modal-content-visible' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="confirm-message">{state.options.message}</p>
            <div className="confirm-actions">
              <button onClick={() => handleResponse(false)} className="confirm-cancel">
                {state.options.cancelText || '取消'}
              </button>
              <button
                onClick={() => handleResponse(true)}
                className={`confirm-ok ${state.options.danger ? 'confirm-danger' : ''}`}
              >
                {state.options.confirmText || '確認'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
