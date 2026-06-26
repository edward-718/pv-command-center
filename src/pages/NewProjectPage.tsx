import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, FileStack, Sparkles } from 'lucide-react';
import { useStore, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Chip } from '@/components/Badge';
import { cn, formatDate } from '@/lib/utils';
import { PROJECT_TYPE_LABEL, type ProjectType, type Template } from '@/types';

const TYPE_DESC: Record<ProjectType, string> = {
  ICSR: '个例安全报告，含医学审评、质量复核、监管提交。',
  INQUIRY: '监管问询响应：分派、医学评估、回复、提交。',
  CAPA: 'CAPA 整改闭环：根因分析、行动项、效果评估。',
  PSUR: '定期安全更新报告项目管理。',
};

const TYPE_TONE: Record<ProjectType, string> = {
  ICSR: 'from-cobalt-500/15 to-cobalt-500/0 border-cobalt-200',
  INQUIRY: 'from-amber-500/15 to-amber-500/0 border-amber-500/30',
  CAPA: 'from-teal-500/15 to-teal-500/0 border-teal-200',
  PSUR: 'from-ink-200 to-ink-100 border-ink-200',
};

export function NewProjectPage() {
  const me = useStore((s) => s.currentUser)!;
  const templates = useStore((s) => s.templates);
  const create = useStore((s) => s.createProjectFromTemplate);
  const navigate = useNavigate();

  const [step, setStep] = useState<'template' | 'detail'>('template');
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [product, setProduct] = useState('');
  const [region, setRegion] = useState('中国 / NMPA');
  const [description, setDescription] = useState('');

  if (!roleCan(me.role, 'create_project')) {
    return (
      <div className="surface p-10 text-center">
        <div className="text-[14px] font-semibold text-ink-800">权限不足</div>
        <div className="text-[12px] text-ink-500 mt-1.5">当前角色无法创建项目</div>
        <button className="btn btn-ghost mt-4" onClick={() => navigate('/projects')}>
          返回项目列表
        </button>
      </div>
    );
  }

  const onSelectTemplate = (t: Template) => {
    setSelectedTpl(t);
    setProduct('');
    setName('');
    setCode(`${t.type === 'ICSR' ? 'ICSR' : t.type === 'INQUIRY' ? 'INQ' : t.type === 'CAPA' ? 'CAPA' : 'PSUR'}-2026-${Math.floor(Math.random() * 900 + 100)}`);
    setDescription('');
    setStep('detail');
  };

  const onSubmit = () => {
    if (!selectedTpl || !name.trim() || !code.trim() || !product.trim()) return;
    const project = create({
      name: name.trim(),
      code: code.trim(),
      type: selectedTpl.type,
      product: product.trim(),
      region: region.trim() || '中国 / NMPA',
      description: description.trim() || `基于「${selectedTpl.name}」创建`,
      templateId: selectedTpl.id,
    });
    navigate(`/projects/${project.id}`);
  };

  return (
    <>
      <button
        onClick={() => (step === 'detail' ? setStep('template') : navigate('/projects'))}
        className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {step === 'detail' ? '返回选择模板' : '返回项目列表'}
      </button>

      <PageHeader
        title={step === 'template' ? '选择 PV 项目模板' : '完善项目信息'}
        subtitle={
          step === 'template'
            ? '从预置模板开始，PV智枢 会自动生成任务节点、默认角色和必填证据清单。'
            : `${selectedTpl?.name}：包含 ${selectedTpl?.nodes.length ?? 0} 个任务节点，覆盖项目全流程。`
        }
        meta={
          <div className="flex items-center gap-1.5">
            <Step n={1} active={step === 'template'} done={step === 'detail'} label="选模板" />
            <ChevronRight className="w-3.5 h-3.5 text-ink-300" />
            <Step n={2} active={step === 'detail'} done={false} label="填信息" />
          </div>
        }
      />

      {step === 'template' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTemplate(t)}
              className={cn(
                'relative text-left p-5 rounded-2xl border bg-gradient-to-b hover:shadow-pop hover:-translate-y-0.5 transition-all',
                TYPE_TONE[t.type],
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white shadow-soft flex items-center justify-center">
                  <FileStack className="w-4 h-4 text-ink-700" />
                </div>
                <Chip tone="neutral" className="text-[10.5px]">
                  {t.nodes.length} 个节点
                </Chip>
                <Chip tone="amber" className="ml-auto text-[10.5px]">
                  提醒 · {t.reminderThresholds.join('/')} 天
                </Chip>
              </div>
              <h3 className="font-display text-[15px] font-semibold text-ink-900 mb-1.5">{t.name}</h3>
              <p className="text-[12px] text-ink-600 leading-relaxed mb-3 line-clamp-2">{t.description}</p>
              <ol className="space-y-1.5">
                {t.nodes.map((n, i) => (
                  <li key={n.id} className="flex items-center gap-2 text-[11.5px] text-ink-700">
                    <span className="font-mono text-ink-400 w-4">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 truncate">{n.title}</span>
                    <span className="text-[10.5px] text-ink-500 font-mono">+{n.relativeDueDays}d</span>
                  </li>
                ))}
              </ol>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
          <section className="surface p-6">
            <h3 className="font-display text-[15px] font-semibold mb-4">项目基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="field md:col-span-2">
                <label className="field-label">项目名称</label>
                <input
                  className="field-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：泰诺林® 肝损伤信号 ICSR 加速报告"
                />
              </div>
              <div className="field">
                <label className="field-label">项目编号</label>
                <input
                  className="field-input font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ICSR-2026-0142"
                />
              </div>
              <div className="field">
                <label className="field-label">产品</label>
                <input
                  className="field-input"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="泰诺林® 500mg"
                />
              </div>
              <div className="field">
                <label className="field-label">国家 / 监管机构</label>
                <select className="field-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option>中国 / NMPA</option>
                  <option>美国 / FDA</option>
                  <option>欧盟 / EMA</option>
                  <option>日本 / PMDA</option>
                  <option>Global</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">负责人</label>
                <input className="field-input" value={me.name} disabled />
              </div>
              <div className="field md:col-span-2">
                <label className="field-label">项目描述</label>
                <textarea
                  className="field-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述项目背景、关键时限与风险点…"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                className="btn btn-primary"
                onClick={onSubmit}
                disabled={!name.trim() || !code.trim() || !product.trim()}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> 创建并生成任务
              </button>
              <button className="btn btn-ghost" onClick={() => setStep('template')}>
                重新选择模板
              </button>
            </div>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-cobalt-600" />
              <h3 className="font-display text-[14.5px] font-semibold">将自动生成的任务</h3>
            </div>
            <ol className="space-y-2">
              {selectedTpl?.nodes.map((n, i) => (
                <li key={n.id} className="rounded-lg border border-ink-900/5 p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10.5px] text-ink-400 w-5">{String(i + 1).padStart(2, '0')}</span>
                    <div className="text-[13px] font-semibold text-ink-900 flex-1">{n.title}</div>
                    <Chip tone="neutral" className="text-[10px]">+{n.relativeDueDays}d</Chip>
                  </div>
                  {n.requiredEvidence.length > 0 && (
                    <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>必填证据：</span>
                      {n.requiredEvidence.map((e) => (
                        <span key={e} className="chip chip-mono bg-ink-100 text-ink-600 border-ink-200 text-[10px]">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-4 text-[11px] text-ink-500">
              创建于 {formatDate(new Date().toISOString())} · 由 {me.name} 发起
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Step({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-mono font-semibold',
          done && 'bg-teal-600 text-white',
          active && !done && 'bg-cobalt-600 text-white',
          !active && !done && 'bg-ink-200 text-ink-600',
        )}
      >
        {done ? '✓' : n}
      </div>
      <span
        className={cn(
          'text-[12px]',
          active ? 'text-ink-900 font-medium' : 'text-ink-500',
        )}
      >
        {label}
      </span>
    </div>
  );
}
