export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastHostProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (!toasts.length) return null;

  return (
    <div className="toast-host" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div className={`toast-card ${toast.tone}`} key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
