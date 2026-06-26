/**
 * AI 草稿 API（MVP：基于规则拼接，不调用大模型）
 * - POST /api/ai/draft 生成草稿
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

router.post('/draft', (req: Request, res: Response) => {
  const { projectId, kind } = req.body as { projectId?: string; kind?: string };
  if (!projectId || !kind) {
    return res.status(400).json({ code: 400, message: 'projectId and kind required' });
  }
  // 实际生产中此处应调用大模型或检索增强生成
  const draft = `# AI 草稿 · ${kind}\n\n项目: ${projectId}\n生成时间: ${new Date().toISOString()}\n\n> 此为占位实现，正式版将接入检索增强生成。`;
  res.json({ code: 0, data: { id: `aig-${Date.now()}`, projectId, kind, content: draft, createdAt: new Date().toISOString(), confirmed: false } });
});

export default router;
