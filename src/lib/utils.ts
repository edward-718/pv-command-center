// 通用工具函数
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso?: string, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (!withTime) return `${yyyy}-${mm}-${dd}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function relativeFromNow(iso?: string) {
  if (!iso) return '—';
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const abs = Math.abs(diffMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const past = diffMs < 0;
  if (days >= 1) {
    return past ? `${days} 天前` : `${days} 天后`;
  }
  if (hours >= 1) {
    return past ? `${hours} 小时前` : `${hours} 小时后`;
  }
  if (minutes >= 1) {
    return past ? `${minutes} 分钟前` : `${minutes} 分钟后`;
  }
  return past ? '刚刚' : '即将';
}

export function dueUrgency(iso?: string): 'overdue' | 'today' | 'soon' | 'ok' {
  if (!iso) return 'ok';
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const diffDays = diffMs / 86_400_000;
  if (diffMs < 0) return 'overdue';
  if (diffDays <= 0.5) return 'today';
  if (diffDays <= 3) return 'soon';
  return 'ok';
}

export function isOverdue(iso?: string) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function fileSizeFmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function plural(n: number, cn: string) {
  return `${n} ${cn}`;
}

// 状态机：合法状态流转
const ALLOWED: Record<string, string[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW', 'NEEDS_INFO', 'NOT_STARTED'],
  IN_REVIEW: ['DONE', 'NEEDS_INFO'],
  NEEDS_INFO: ['IN_PROGRESS', 'IN_REVIEW'],
  DONE: [],
};

export function canTransition(from: string, to: string) {
  return ALLOWED[from]?.includes(to);
}

export function nextStates(from: string) {
  return ALLOWED[from] ?? [];
}

// 给定 ISO 日期，返回与今日的距离（天数，负数表示过去）
export function daysFromNow(iso?: string) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (new Date(iso).getTime() - Date.now()) / 86_400_000;
}
