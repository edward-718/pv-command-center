import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { ROLE_LABEL, ROLE_TONE, type Role } from '@/types';
import { Avatar } from '@/components/Avatar';
import { Activity, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_DESC: Record<Role, string> = {
  PM: '创建项目、配置模板、分配任务、查看全部项目数据。',
  PROCESSOR: '处理被分配任务、上传附件、提交复核。',
  PHYSICIAN: '填写医学意见、标记升级事项。',
  QA: '查看审计记录、发起质量复核、导出审计包。',
  VENDOR: '仅访问授权项目、提交交付物。',
  ADMIN: '管理组织、角色、模板和系统配置。',
};

const ROLE_KEYS: Role[] = ['PM', 'PROCESSOR', 'PHYSICIAN', 'QA', 'VENDOR', 'ADMIN'];

export function LoginPage() {
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const login = useStore((s) => s.login);
  const navigate = useNavigate();

  // 已登录用户直接进入工作台
  useEffect(() => {
    if (currentUser) {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleLogin = (userId: string) => {
    login(userId);
    // login 更新 currentUser 后，上面的 useEffect 会触发跳转
    // 这里也做一次兜底，避免 useEffect 未触发
    setTimeout(() => navigate('/', { replace: true }), 0);
  };

  return (
    <div className="min-h-full grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-ink-50">
      <div className="hidden lg:flex relative overflow-hidden p-12 flex-col justify-between bg-gradient-to-br from-ink-900 via-ink-800 to-cobalt-800">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-500/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cobalt-500/30 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <div className="w-full h-full bg-[linear-gradient(to_right,rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Activity className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <div className="font-display text-[18px] font-semibold text-white">PV智枢</div>
              <div className="text-[11px] text-white/60 tracking-wider">PHARMACOVIGILANCE COMMAND CENTER</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur text-[11px] text-white/80 font-mono mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse-soft" />
            v0.1 · MVP 演示版
          </div>
          <h1 className="font-display text-[44px] leading-[1.1] font-semibold text-white text-balance">
            把 PV 项目里
            <br />
            散落的任务、时限与证据
            <br />
            <span className="text-teal-300">集中到同一张作战地图</span>
          </h1>
          <p className="text-[15px] text-white/70 leading-relaxed mt-5 max-w-md">
            PV智枢把 ICSR、监管问询、CAPA 等项目中分散的任务、文档、时限和审计记录集中到同一工作台，
            让团队清楚知道"现在最该处理什么、谁负责、风险在哪里、证据是否完整"。
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3 max-w-xl">
          {[
            { icon: Workflow, label: '主流程闭环', desc: '模板 → 任务 → 复核 → 审计' },
            { icon: ShieldCheck, label: '合规留痕', desc: '关键操作全量审计' },
            { icon: Sparkles, label: 'AI 草稿', desc: '周报 / 纪要 / CAPA' },
          ].map((f) => (
            <div key={f.label} className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 backdrop-blur">
              <f.icon className="w-4 h-4 text-teal-300 mb-1.5" />
              <div className="text-[12.5px] font-semibold text-white">{f.label}</div>
              <div className="text-[11px] text-white/60 mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-8 lg:p-12 flex flex-col justify-center max-w-2xl w-full mx-auto">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-cobalt-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display text-[16px] font-semibold">PV智枢</div>
            <div className="text-[11px] text-ink-500">药物警戒 · 项目指挥中心</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-[12px] font-mono text-teal-700 mb-1.5">演示登录</div>
          <h2 className="font-display text-[28px] font-semibold tracking-tight">
            选择一个角色进入工作台
          </h2>
          <p className="text-[13.5px] text-ink-500 mt-2 max-w-md">
            本演示版使用预设的 6 个账号展示不同角色看到的数据与可执行操作。点击任意身份即可进入。
          </p>
        </div>

        <div className="space-y-2.5">
          {ROLE_KEYS.map((role) => {
            const user = users.find((u) => u.role === role);
            if (!user) return null;
            return (
              <button
                key={role}
                onClick={() => handleLogin(user.id)}
                className="w-full text-left surface-soft p-3.5 flex items-center gap-3.5 hover:shadow-panel hover:-translate-y-0.5 transition-all group"
              >
                <Avatar userId={user.id} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display text-[14.5px] font-semibold text-ink-900">
                      {user.name}
                    </div>
                    <span className={cn('chip chip-mono', ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>
                  </div>
                  <div className="text-[12px] text-ink-500 mt-1 leading-snug">{ROLE_DESC[role]}</div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 text-[12px] text-teal-700 font-medium transition-opacity">
                  进入 →
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-[11.5px] text-ink-500 leading-relaxed">
          所有数据保存在浏览器 localStorage 中，可随时通过右上角"重置演示数据"恢复。AI 输出仅作为草稿，
          不会自动改变任务状态或替代医学判断。
        </div>
      </div>
    </div>
  );
}
