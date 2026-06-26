import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABEL, TASK_STATUS_TONE, type TaskStatus } from '@/types';

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={cn('chip', TASK_STATUS_TONE[status])}>
      <span
        className={cn('dot', {
          'bg-ink-400': status === 'NOT_STARTED',
          'bg-cobalt-500 animate-pulse-soft': status === 'IN_PROGRESS',
          'bg-amber-500 animate-pulse-soft': status === 'IN_REVIEW',
          'bg-danger-500': status === 'NEEDS_INFO',
          'bg-teal-500': status === 'DONE',
        })}
      />
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityTag({ p }: { p: 'P0' | 'P1' | 'P2' }) {
  const tone = {
    P0: 'bg-danger-500/10 text-danger-700 border-danger-500/30',
    P1: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    P2: 'bg-ink-100 text-ink-600 border-ink-200',
  }[p];
  return <span className={cn('chip chip-mono', tone)}>{p}</span>;
}

export function RiskTag({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const tone = {
    LOW: 'bg-teal-50 text-teal-700 border-teal-200',
    MEDIUM: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    HIGH: 'bg-danger-500/10 text-danger-700 border-danger-500/30',
  }[level];
  const label = { LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险' }[level];
  return <span className={cn('chip', tone)}>{label}</span>;
}

export function SeverityTag({
  severity,
}: {
  severity?: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
}) {
  if (!severity) return null;
  const map = {
    MILD: { tone: 'bg-ink-100 text-ink-700', label: '轻度' },
    MODERATE: { tone: 'bg-amber-500/10 text-amber-700', label: '中度' },
    SEVERE: { tone: 'bg-danger-500/10 text-danger-700', label: '重度' },
    LIFE_THREATENING: { tone: 'bg-danger-600 text-white', label: '危及生命' },
  };
  const v = map[severity];
  return <span className={cn('chip', v.tone)}>严重性 · {v.label}</span>;
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'cobalt' | 'amber' | 'danger' | 'ink';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700 border-ink-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    cobalt: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
    amber: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    danger: 'bg-danger-500/10 text-danger-700 border-danger-500/30',
    ink: 'bg-ink-900 text-white border-ink-900',
  } as const;
  return <span className={cn('chip', tones[tone], className)}>{children}</span>;
}

export function StatusFlowBar({ status }: { status: TaskStatus }) {
  const order: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const currentIdx = order.indexOf(status);
  const isNeedsInfo = status === 'NEEDS_INFO';
  return (
    <div className="flex items-center gap-1">
      {order.map((s, i) => {
        const active = i <= currentIdx && !isNeedsInfo;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className={cn(
                'h-1.5 w-6 rounded-full transition-colors',
                active ? 'bg-teal-500' : 'bg-ink-200',
                s === 'IN_REVIEW' && active && 'bg-amber-500',
              )}
            />
          </div>
        );
      })}
      {isNeedsInfo && (
        <div className="ml-2 chip bg-danger-500/10 text-danger-700 border-danger-500/30">
          <span className="dot bg-danger-500" />
          需补充
        </div>
      )}
    </div>
  );
}
