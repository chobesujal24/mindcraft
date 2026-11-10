import { useToasts } from "../hooks/useToasts";
import { Toast } from "../ui/Toast";

export function ToastStack() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
