import { useStore } from '@/store/useStore';
import { ROLE_LABEL, ROLE_TONE, type Role } from '@/types';
import { cn } from '@/lib/utils';

export function Avatar({ userId, size = 28 }: { userId?: string; size?: number }) {
  const user = useStore((s) => s.users.find((u) => u.id === userId));
  if (!user) {
    return (
      <div
        className="rounded-full bg-ink-100 text-ink-500 inline-flex items-center justify-center text-[10px] font-medium"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }
  const initials = user.name.slice(0, 1);
  const palette: Record<Role, string> = {
    PM: 'bg-teal-100 text-teal-700',
    PROCESSOR: 'bg-cobalt-100 text-cobalt-700',
    PHYSICIAN: 'bg-amber-500/15 text-amber-700',
    QA: 'bg-cobalt-100 text-cobalt-600',
    VENDOR: 'bg-ink-200 text-ink-700',
    ADMIN: 'bg-ink-900 text-white',
  };
  return (
    <div
      className={cn(
        'rounded-full inline-flex items-center justify-center font-semibold',
        palette[user.role],
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={`${user.name} · ${ROLE_LABEL[user.role]}`}
    >
      {initials}
    </div>
  );
}

export function AvatarStack({ userIds, max = 4 }: { userIds: string[]; max?: number }) {
  const visible = userIds.slice(0, max);
  const extra = userIds.length - visible.length;
  return (
    <div className="flex -space-x-1.5">
      {visible.map((id) => (
        <div key={id} className="ring-2 ring-white rounded-full inline-block">
          <Avatar userId={id} size={24} />
        </div>
      ))}
      {extra > 0 && (
        <div className="ring-2 ring-white rounded-full inline-flex items-center justify-center bg-ink-100 text-ink-600 text-[10px] font-medium" style={{ width: 24, height: 24 }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

export function RoleChip({ role }: { role: Role }) {
  return <span className={cn('chip chip-mono', ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>;
}
