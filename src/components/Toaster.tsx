import { useStore } from '@/store/useStore';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="fixed top-16 right-6 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-label="通知">
      {toasts.map((t) => {
        const tone = {
          success: 'border-teal-200 bg-white text-ink-900',
          error: 'border-danger-500/30 bg-white text-ink-900',
          info: 'border-cobalt-200 bg-white text-ink-900',
        }[t.kind];
        const Icon = {
          success: CheckCircle2,
          error: XCircle,
          info: Info,
        }[t.kind];
        const iconColor = {
          success: 'text-teal-600',
          error: 'text-danger-600',
          info: 'text-cobalt-600',
        }[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto surface px-3.5 py-2.5 flex items-center gap-2.5 shadow-pop min-w-[260px] max-w-sm animate-fade-up',
              tone,
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0', iconColor)} aria-hidden="true" />
            <div className="flex-1 text-[12.5px] leading-snug">{t.message}</div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-400 hover:text-ink-700 text-[14px] leading-none"
              aria-label="关闭通知"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
