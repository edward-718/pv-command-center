/**
 * AI 草稿 API（MVP：基于规则拼接，不调用大模型）
 * - GET  /api/ai/drafts          AI 草稿列表
 * - POST /api/ai/draft          生成草稿
 * - PUT  /api/ai/draft/:id/confirm  确认草稿
 */
import { Router, type Request, type Response } from 'express';
import pvStore from '../store.js';
import { authenticate, requirePermission, type AuthUser } from '../middleware/auth.js';

const router = Router();

type AIDraft = {
  id: string;
  projectId: string;
  authorId: string;
  kind: string;
  content: string;
  confirmed: boolean;
  createdAt: string;
};

// 获取 AI 草稿列表（需认证）
router.get('/drafts', authenticate, (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { projectId, confirmed } = req.query as { projectId?: string; confirmed?: string };
  let list = [...(pvStore.aiDrafts as AIDraft[])].filter((d) => d.authorId === user.id);
  if (projectId) list = list.filter((d) => d.projectId === projectId);
  if (confirmed !== undefined) list = list.filter((d) => d.confirmed === (confirmed === 'true'));
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ code: 0, data: list });
});

// 生成 AI 草稿（需认证 + ai:generate 权限）
router.post('/draft', authenticate, requirePermission('ai:generate'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { projectId, kind } = req.body as { projectId?: string; kind?: string };
  if (!projectId || !kind) return res.status(400).json({ code: 400, message: 'projectId and kind required' });
  const draft: AIDraft = {
    id: `aig-${Date.now()}`,
    projectId,
    authorId: user.id,
    kind,
    content: generateDraftContent(kind, projectId, pvStore),
    confirmed: false,
    createdAt: new Date().toISOString(),
  };
  (pvStore.aiDrafts as unknown[]).unshift(draft);
  pvStore.save();
  res.json({ code: 0, data: draft });
});

// 确认 AI 草稿（需认证 + ai:confirm 权限）
router.put('/draft/:id/confirm', authenticate, requirePermission('ai:confirm'), (req: Request, res: Response) => {
  const draft = (pvStore.aiDrafts as AIDraft[]).find((d) => d.id === req.params.id);
  if (!draft) return res.status(404).json({ code: 404, message: 'draft not found' });
  if (draft.confirmed) return res.status(400).json({ code: 400, message: 'draft already confirmed' });
  draft.confirmed = true;
  pvStore.save();
  res.json({ code: 0, data: draft });
});

function generateDraftContent(kind: string, projectId: string, store: typeof pvStore): string {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const project = (store.projects as Array<Record<string, unknown>>).find((p) => p.id === projectId);
  const projectTasks = Array.from(store.tasks.values()).filter((t) => (t as { projectId: string }).projectId === projectId);
  const doneTasks = projectTasks.filter((t) => (t as { status: string }).status === 'DONE').length;
  const inProgressTasks = projectTasks.filter((t) => (t as { status: string }).status === 'IN_PROGRESS').length;
  const inReviewTasks = projectTasks.filter((t) => (t as { status: string }).status === 'IN_REVIEW').length;
  const overdueTasks = projectTasks.filter((t) => {
    const due = new Date((t as { dueAt: string }).dueAt).getTime();
    return due < Date.now() && (t as { status: string }).status !== 'DONE';
  });
  const highRiskTasks = projectTasks.filter((t) => (t as { riskLevel: string }).riskLevel === 'HIGH');
  const p0Tasks = projectTasks.filter((t) => (t as { priority: string }).priority === 'P0');

  // 按状态分布
  const statusDist = {
    '未开始': projectTasks.filter((t) => (t as { status: string }).status === 'NOT_STARTED').length,
    '处理中': inProgressTasks,
    '待复核': inReviewTasks,
    '需补充': projectTasks.filter((t) => (t as { status: string }).status === 'NEEDS_INFO').length,
    '已完成': doneTasks,
  };

  // 按风险等级分布
  const riskDist = {
    '高': projectTasks.filter((t) => (t as { riskLevel: string }).riskLevel === 'HIGH').length,
    '中': projectTasks.filter((t) => (t as { riskLevel: string }).riskLevel === 'MEDIUM').length,
    '低': projectTasks.filter((t) => (t as { riskLevel: string }).riskLevel === 'LOW').length,
  };

  // 计算进度
  const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;

  switch (kind) {
    case 'WEEKLY': return `# 周报草稿

**项目**: ${(project as { name?: string })?.name || projectId} ${(project as { code?: string })?.code ? `(${project.code})` : ''}
**生成时间**: ${timestamp}

## 一、项目概览

| 指标 | 数值 |
|---|---|
| 任务总数 | ${projectTasks.length} |
| 已完成 | ${doneTasks} |
| 进行中 | ${inProgressTasks} |
| 待复核 | ${inReviewTasks} |
| 逾期任务 | ${overdueTasks.length} |
| 项目进度 | ${progress}% |

## 二、任务状态分布

${Object.entries(statusDist).map(([k, v]) => `- **${k}**: ${v} 项`).join('\n')}

## 三、风险概览

${riskDist.high > 0 ? `⚠️ 高风险任务: ${riskDist.high} 项\n` : ''}${overdueTasks.length > 0 ? `⚠️ 逾期任务: ${overdueTasks.length} 项\n` : ''}${p0Tasks.length > 0 ? `🔴 P0 紧急任务: ${p0Tasks.length} 项\n` : ''}${riskDist.high === 0 && overdueTasks.length === 0 && p0Tasks.length === 0 ? '✅ 无高风险/逾期/P0 任务\n' : ''}

${overdueTasks.length > 0 ? '### 逾期任务详情\n' + overdueTasks.slice(0, 5).map((t) => `- ${(t as { title: string }).title} (逾期 ${Math.ceil((Date.now() - new Date((t as { dueAt: string }).dueAt).getTime()) / (24 * 60 * 60 * 1000))} 天)`).join('\n') : ''}

## 四、本周进展

${doneTasks > 0 ? `- ✅ 完成 ${doneTasks} 项任务` : '- 暂无完成的任务'}
${inReviewTasks > 0 ? `- 🔍 ${inReviewTasks} 项任务待复核` : ''}

## 五、下周计划

${inProgressTasks > 0 ? `- 继续推进 ${inProgressTasks} 项进行中的任务` : ''}
${overdueTasks.length > 0 ? `- ⚠️ 重点跟进 ${overdueTasks.length} 项逾期任务` : ''}
${p0Tasks.length > 0 ? `- 🔴 紧急处理 ${p0Tasks.length} 项 P0 任务` : ''}

---
> 本草稿由 PV 智枢系统自动生成，基于项目实时数据。
> 仅供参考，请人工审核后使用。
`;
    case 'MEETING': return `# 会议纪要草稿

**项目**: ${(project as { name?: string })?.name || projectId}
**生成时间**: ${timestamp}

## 会议信息

- **日期**: ${new Date().toLocaleDateString('zh-CN')}
- **参会人员**: （请手动填写）
- **主持人**: （请手动填写）

## 议程

1. 项目进度回顾
2. 问题与风险讨论
3. 下一步行动计划

## 讨论内容

### 1. 项目进度
- 总体进度: ${progress}%
- 任务完成: ${doneTasks}/${projectTasks.length}
- 逾期: ${overdueTasks.length} 项

### 2. 风险与问题
${overdueTasks.length > 0 ? `- ⚠️ 逾期风险: ${overdueTasks.length} 项任务逾期\n` : ''}${highRiskTasks.length > 0 ? `- 🔴 高风险: ${highRiskTasks.length} 项\n` : ''}${overdueTasks.length === 0 && highRiskTasks.length === 0 ? '- ✅ 暂无重大风险\n' : ''}

### 3. 行动项
（请手动填写）

## 决议事项

（请手动填写）

## 下次会议

- **时间**: （请手动填写）
- **议题**: （请手动填写）

---
> 本草稿由 PV 智枢系统自动生成。
> 请在会议后补充具体内容。
`;
    case 'CAPA': return `# CAPA 报告草稿

**项目**: ${(project as { name?: string })?.name || projectId}
**生成时间**: ${timestamp}

## 1. 问题描述

**问题编号**: （请手动填写）
**发现日期**: ${new Date().toLocaleDateString('zh-CN')}
**问题来源**: （请选择：内部审计/外部审计/日常检查/投诉/其他）

### 问题详情
（请手动填写具体问题描述）

## 2. 影响评估

| 维度 | 评估 |
|---|---|
| 受影响产品 | （请填写） |
| 影响范围 | （请填写） |
| 严重程度 | （请选择：轻微/中等/严重/致命） |

## 3. 根因分析

**分析方法**: （请选择：5-Why/鱼骨图/FMEA/其他）

### 根因
（请手动填写）

## 4. CAPA 行动项

| 行动项 | 责任人 | 目标日期 | 状态 |
|---|---|---|---|
| （请填写） | （请填写） | （请填写） | 待执行 |

## 5. 预防措施

（请手动填写预防措施，确保类似问题不再发生）

## 6. 效果验证

**验证方法**: （请选择：复审/数据监控/跟进检查）
**验证日期**: （请填写）
**验证结果**: （请填写）

---
> 本草稿由 PV 智枢系统自动生成。
> 请根据实际情况补充完整 CAPA 信息。
`;
    case 'RISK': return `# 风险评估报告草稿

**项目**: ${(project as { name?: string })?.name || projectId}
**生成时间**: ${timestamp}

## 1. 风险概览

| 指标 | 数值 |
|---|---|
| 任务总数 | ${projectTasks.length} |
| 高风险任务 | ${riskDist.high} |
| 中风险任务 | ${riskDist.中} |
| 逾期任务 | ${overdueTasks.length} |
| P0 紧急任务 | ${p0Tasks.length} |

## 2. 风险等级分布

${Object.entries(riskDist).map(([k, v]) => `- **${k}风险**: ${v} 项`).join('\n')}

## 3. 当前风险识别

### 3.1 逾期风险
${overdueTasks.length > 0 ? overdueTasks.slice(0, 5).map((t) => `- **${(t as { title: string }).title}**\n  - 逾期天数: ${Math.ceil((Date.now() - new Date((t as { dueAt: string }).dueAt).getTime()) / (24 * 60 * 60 * 1000))} 天\n  - 负责人: ${(t as { assigneeId: string }).assigneeId}\n  - 状态: ${(t as { status: string }).status}`).join('\n\n') : '无逾期任务。'}

### 3.2 高风险任务
${highRiskTasks.length > 0 ? highRiskTasks.slice(0, 5).map((t) => `- **${(t as { title: string }).title}**\n  - 风险等级: ${(t as { riskLevel: string }).riskLevel}\n  - 截止日期: ${(t as { dueAt: string }).dueAt}\n  - 状态: ${(t as { status: string }).status}`).join('\n\n') : '无高风险任务。'}

### 3.3 P0 紧急任务
${p0Tasks.length > 0 ? p0Tasks.slice(0, 5).map((t) => `- **${(t as { title: string }).title}**\n  - 截止日期: ${(t as { dueAt: string }).dueAt}\n  - 状态: ${(t as { status: string }).status}`).join('\n\n') : '无 P0 紧急任务。'}

## 4. 综合风险评级

**评估**: ${
  overdueTasks.length > 0 || riskDist.high > 3 ? '🔴 高风险' :
  overdueTasks.length > 0 || riskDist.high > 0 ? '🟡 中风险' :
  '🟢 低风险'
}

## 5. 应对策略建议

${overdueTasks.length > 0 ? '1. **立即处理逾期任务**: 优先分配资源处理逾期任务，避免监管合规风险。' : ''}
${highRiskTasks.length > 0 ? '2. **加强高风险任务监控**: 设定更频繁的进度检查点。' : ''}
${p0Tasks.length > 0 ? '3. **启动 P0 应急响应**: 24 小时内处理所有 P0 任务。' : ''}
${overdueTasks.length === 0 && highRiskTasks.length === 0 && p0Tasks.length === 0 ? '1. **保持当前状态**: 继续按计划推进项目。' : ''}
2. **定期风险评估**: 建议每周进行一次风险评估。

---
> 本报告由 PV 智枢系统自动生成，基于项目实时数据。
> 仅供参考，请人工审核确认风险评估结果。
`;
    default: return `# AI 草稿

**项目**: ${(project as { name?: string })?.name || projectId}
**生成时间**: ${timestamp}

> 占位实现，正式版将接入检索增强生成。
`;
  }
}

export default router;
