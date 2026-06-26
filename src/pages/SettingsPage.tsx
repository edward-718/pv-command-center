import { useStore } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar, RoleChip } from '@/components/Avatar';
import { Chip } from '@/components/Badge';
import { ROLE_LABEL, type Role } from '@/types';
import { Bell, FileStack, RotateCcw, ShieldCheck, Users2 } from 'lucide-react';

export function SettingsPage() {
  const me = useStore((s) => s.currentUser)!;
  const users = useStore((s) => s.users);
  const templates = useStore((s) => s.templates);
  const notifications = useStore((s) => s.notifications);
  const auditLogs = useStore((s) => s.auditLogs);
  const resetData = useStore((s) => s.resetData);
  const logout = useStore((s) => s.logout);

  if (me.role !== 'ADMIN') {
    return (
      <div className="surface p-10 text-center">
        <ShieldCheck className="w-8 h-8 text-ink-400 mx-auto mb-3" />
        <div className="text-[14px] font-semibold text-ink-800">需要管理员权限</div>
        <div className="text-[12px] text-ink-500 mt-1.5">请使用系统管理员角色登录</div>
      </div>
    );
  }

  const roles: Role[] = ['PM', 'PROCESSOR', 'PHYSICIAN', 'QA', 'VENDOR', 'ADMIN'];

  return (
    <>
      <PageHeader
        title="系统配置"
        subtitle="管理用户、角色、模板与提醒规则。所有更改会写入审计日志。"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="surface p-5">
          <h3 className="font-display text-[14.5px] font-semibold mb-3 flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5 text-cobalt-600" /> 用户与角色
          </h3>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="rounded-lg border border-ink-900/5 p-3 flex items-center gap-3">
                <Avatar userId={u.id} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink-900">{u.name}</div>
                  <div className="text-[10.5px] text-ink-500">{u.email}</div>
                </div>
                <RoleChip role={u.role} />
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-[14.5px] font-semibold mb-3 flex items-center gap-1.5">
            <FileStack className="w-3.5 h-3.5 text-cobalt-600" /> 模板配置
          </h3>
          <div className="space-y-2.5">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-ink-900/5 p-3">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-semibold text-ink-900 flex-1">{t.name}</div>
                  <Chip tone="neutral" className="text-[10.5px]">
                    提醒 {t.reminderThresholds.join('/')} 天
                  </Chip>
                </div>
                <div className="text-[11px] text-ink-500 mt-1">{t.nodes.length} 个节点 · {t.nodes.reduce((s, n) => s + n.requiredEvidence.length, 0)} 个必填证据</div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-[14.5px] font-semibold mb-3 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-cobalt-600" /> 提醒与通知
          </h3>
          <div className="space-y-2.5 text-[12.5px]">
            <SettingRow label="通知渠道" value="站内通知（已启用）" />
            <SettingRow label="邮件通知" value="未启用（MVP）" pending />
            <SettingRow label="提醒阈值" value="到期前 7 / 3 / 1 天" />
            <SettingRow label="逾期提示" value="每日 09:00 提醒责任人" />
            <SettingRow label="复核超时" value="48 小时未处理自动提醒" />
          </div>
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-[14.5px] font-semibold mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cobalt-600" /> 安全与审计
          </h3>
          <div className="space-y-2.5 text-[12.5px]">
            <SettingRow label="租户隔离" value="按组织隔离" />
            <SettingRow label="角色访问控制" value="角色 + 项目成员" />
            <SettingRow label="审计日志" value={`已记录 ${auditLogs.length} 条`} />
            <SettingRow label="会话超时" value="8 小时" />
            <SettingRow label="附件敏感权限" value="下载时校验" />
          </div>
        </section>

        <section className="surface p-5 lg:col-span-2">
          <h3 className="font-display text-[14.5px] font-semibold mb-3">演示数据</h3>
          <div className="text-[12.5px] text-ink-600 leading-relaxed mb-3">
            当前共 {users.length} 个用户、{templates.length} 个模板、{notifications.length} 条通知、{auditLogs.length} 条审计日志。
            点击下方按钮可重置所有数据为初始演示状态。
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetData();
                logout();
              }}
              className="btn btn-danger text-[12px]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 重置演示数据并退出
            </button>
            <span className="text-[11px] text-ink-500">所有本地数据将被清除，下次登录从种子数据开始</span>
          </div>
        </section>
      </div>
    </>
  );
}

function SettingRow({ label, value, pending }: { label: string; value: string; pending?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-ink-500 text-[11.5px] uppercase tracking-wider">{label}</div>
      <div className="text-ink-800 font-medium flex items-center gap-1.5">
        {value}
        {pending && <Chip tone="amber" className="text-[10px]">待确认</Chip>}
      </div>
    </div>
  );
}
