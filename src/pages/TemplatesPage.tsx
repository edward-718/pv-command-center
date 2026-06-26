import { useState } from 'react';
import { useStore, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Chip } from '@/components/Badge';
import { cn, formatDate } from '@/lib/utils';
import { PROJECT_TYPE_LABEL, type Template, type TemplateNode } from '@/types';
import { CheckCircle2, FileStack, Pencil, Plus } from 'lucide-react';

export function TemplatesPage() {
  const me = useStore((s) => s.currentUser)!;
  const templates = useStore((s) => s.templates);
  const update = useStore((s) => s.updateTemplate);
  const [selectedId, setSelectedId] = useState(templates[0]?.id);

  const selected = templates.find((t) => t.id === selectedId);

  const canEdit = roleCan(me.role, 'edit_template');

  return (
    <>
      <PageHeader
        title="PV 项目模板"
        subtitle="预置的项目模板决定任务节点、默认角色、必填证据和提醒阈值。修改后只影响后续创建的项目。"
        actions={
          canEdit && (
            <button className="btn btn-primary text-[12px]">
              <Plus className="w-3.5 h-3.5" /> 新建模板
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        <aside className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={cn(
                'w-full text-left p-3.5 rounded-xl border transition-all',
                t.id === selectedId
                  ? 'border-teal-500/40 bg-teal-50/30 shadow-soft'
                  : 'border-ink-900/5 hover:border-ink-900/15 bg-white',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FileStack className="w-3.5 h-3.5 text-cobalt-600" />
                <span className="chip chip-mono bg-ink-100 text-ink-700 border-ink-200">
                  {PROJECT_TYPE_LABEL[t.type]}
                </span>
              </div>
              <div className="font-display text-[13.5px] font-semibold text-ink-900">{t.name}</div>
              <div className="text-[11.5px] text-ink-500 mt-1 line-clamp-2">{t.description}</div>
              <div className="mt-2 text-[10.5px] text-ink-500 font-mono">
                {t.nodes.length} 个节点 · 提醒 {t.reminderThresholds.join('/')} 天
              </div>
            </button>
          ))}
        </aside>

        {selected ? (
          <TemplateDetail
            key={selected.id}
            template={selected}
            canEdit={canEdit}
            onSave={(patch) => update(selected.id, patch)}
          />
        ) : (
          <div className="surface p-10 text-center text-[12.5px] text-ink-500">
            请选择左侧模板查看详情
          </div>
        )}
      </div>
    </>
  );
}

function TemplateDetail({
  template,
  canEdit,
  onSave,
}: {
  template: Template;
  canEdit: boolean;
  onSave: (patch: Partial<Template>) => void;
}) {
  return (
    <section className="surface p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-ink-900">{template.name}</h2>
          <p className="text-[12.5px] text-ink-500 mt-1 max-w-2xl">{template.description}</p>
        </div>
        {canEdit && (
          <button className="btn btn-soft text-[12px]">
            <Pencil className="w-3.5 h-3.5" /> 编辑
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="任务节点" value={template.nodes.length} />
        <Stat label="提醒阈值" value={template.reminderThresholds.join(' / ') + ' 天'} />
        <Stat label="必填证据" value={template.nodes.reduce((s, n) => s + n.requiredEvidence.length, 0)} />
        <Stat label="状态" value="可用" />
      </div>

      <h3 className="font-display text-[14.5px] font-semibold mb-3">任务节点（按相对截止时间排列）</h3>
      <ol className="space-y-2.5">
        {template.nodes.map((n, i) => (
          <NodeRow key={n.id} n={n} idx={i + 1} />
        ))}
      </ol>

      <div className="mt-6 pt-5 border-t border-ink-900/5 flex items-center gap-2 text-[12px] text-ink-500">
        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
        模板更改后只影响后续基于该模板创建的项目，存量项目不受影响。
      </div>
    </section>
  );
}

function NodeRow({ n, idx }: { n: TemplateNode; idx: number }) {
  return (
    <li className="rounded-xl border border-ink-900/5 bg-white p-4 flex items-start gap-3.5">
      <div className="w-7 h-7 rounded-lg bg-cobalt-50 flex items-center justify-center font-mono text-[12px] font-semibold text-cobalt-700 shrink-0">
        {String(idx).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-display text-[13.5px] font-semibold text-ink-900">{n.title}</div>
          <span className="chip chip-mono bg-ink-100 text-ink-700 border-ink-200">{n.type}</span>
        </div>
        {n.description && (
          <div className="text-[11.5px] text-ink-500 mt-1">{n.description}</div>
        )}
        {n.requiredEvidence.length > 0 && (
          <div className="text-[11px] text-ink-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span>必填证据：</span>
            {n.requiredEvidence.map((e) => (
              <span key={e} className="chip chip-mono bg-teal-50 text-teal-700 border-teal-200">
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10.5px] uppercase tracking-widest text-ink-500">相对截止</div>
        <div className="font-display text-[16px] font-semibold text-ink-900 leading-none mt-0.5">
          +{n.relativeDueDays}<span className="text-[10px] text-ink-500 ml-0.5">天</span>
        </div>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-widest text-ink-500">{label}</div>
      <div className="font-display text-[15px] font-semibold text-ink-900 mt-0.5">{value}</div>
    </div>
  );
}
