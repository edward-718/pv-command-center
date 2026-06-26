/**
 * AI 草稿 API（MVP：基于规则拼接，不调用大模型）
 * - GET  /api/ai/drafts          AI 草稿列表
 * - POST /api/ai/draft          生成草稿
 * - PUT  /api/ai/draft/:id/confirm  确认草稿
 */
import { Router, type Request, type Response } from 'express';

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

const g = globalThis as unknown as { __pvStore?: { aiDrafts: AIDraft[] } };
if (!g.__pvStore) g.__pvStore = { aiDrafts: [] };
const store = g.__pvStore;

// 获取 AI 草稿列表
router.get('/drafts', (req: Request, res: Response) => {
  const { projectId, authorId, confirmed } = req.query as { projectId?: string; authorId?: string; confirmed?: string };
  let list = [...store.aiDrafts];
  if (projectId) list = list.filter((d) => d.projectId === projectId);
  if (authorId) list = list.filter((d) => d.authorId === authorId);
  if (confirmed !== undefined) list = list.filter((d) => d.confirmed === (confirmed === 'true'));
  // 按时间倒序
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ code: 0, data: list });
});

// 生成 AI 草稿
router.post('/draft', (req: Request, res: Response) => {
  const { projectId, kind, authorId = 'u-001' } = req.body as { projectId?: string; kind?: string; authorId?: string };
  if (!projectId || !kind) {
    return res.status(400).json({ code: 400, message: 'projectId and kind required' });
  }
  // 实际生产中此处应调用大模型或检索增强生成
  const draft: AIDraft = {
    id: `aig-${Date.now()}`,
    projectId,
    authorId,
    kind,
    content: generateDraftContent(kind, projectId),
    confirmed: false,
    createdAt: new Date().toISOString(),
  };
  store.aiDrafts.unshift(draft);
  res.json({ code: 0, data: draft });
});

// 确认 AI 草稿
router.put('/draft/:id/confirm', (req: Request, res: Response) => {
  const draft = store.aiDrafts.find((d) => d.id === req.params.id);
  if (!draft) return res.status(404).json({ code: 404, message: 'draft not found' });
  if (draft.confirmed) return res.status(400).json({ code: 400, message: 'draft already confirmed' });
  draft.confirmed = true;
  res.json({ code: 0, data: draft });
});

// 生成草稿内容（占位实现）
function generateDraftContent(kind: string, projectId: string): string {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  switch (kind) {
    case 'WEEKLY':
      return `# 周报草稿

**项目**: ${projectId}
**生成时间**: ${timestamp}

## 本周进展
- 已完成任务数：X 项
- 进行中任务数：Y 项

## 下周计划
- 继续推进处理中的任务
- 跟进逾期任务

> 此为占位实现，正式版将基于项目实际数据生成。`;
    case 'MEETING':
      return `# 会议纪要草稿

**项目**: ${projectId}
**生成时间**: ${timestamp}

## 参会人员
-

## 讨论内容
-

## 决议事项
-

> 此为占位实现，正式版将基于评论和任务数据生成。`;
    case 'CAPA':
      return `# CAPA 报告草稿

**项目**: ${projectId}
**生成时间**: ${timestamp}

## 问题描述
-

## 根本原因
-

## 纠正措施
-

## 预防措施
-

> 此为占位实现，正式版将基于项目数据生成。`;
    case 'RISK':
      return `# 风险评估草稿

**项目**: ${projectId}
**生成时间**: ${timestamp}

## 风险识别
-

## 风险等级
-

## 应对策略
-

> 此为占位实现，正式版将基于任务风险数据生成。`;
    default:
      return `# AI 草稿

**项目**: ${projectId}
**生成时间**: ${timestamp}

> 此为占位实现，正式版将接入检索增强生成。`;
  }
}

export default router;
