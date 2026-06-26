/**
 * 模板管理 API
 * - GET  /api/templates           模板列表
 * - GET  /api/templates/:id      模板详情
 * - PUT  /api/templates/:id      更新模板（仅 PM/ADMIN）
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

type TemplateNode = {
  id: string;
  title: string;
  type: string;
  defaultRole: string;
  relativeDueDays: number;
  requiredEvidence: string[];
  description?: string;
};

type Template = {
  id: string;
  name: string;
  type: string;
  description: string;
  nodes: TemplateNode[];
  reminderThresholds: number[];
};

const g = globalThis as unknown as { __pvStore?: { templates: Template[] } };
if (!g.__pvStore) {
  g.__pvStore = {
    templates: [
      {
        id: 'tpl-icsr',
        name: 'ICSR 加速报告模板',
        type: 'ICSR',
        description: '针对 15 日 / 0 日 个例安全报告的标准任务链，覆盖病例接收、医学审评、质量复核、监管提交。',
        reminderThresholds: [7, 3, 1],
        nodes: [
          {
            id: 'n1',
            title: '病例接收与编号登记',
            type: 'INTAKE',
            defaultRole: 'PROCESSOR',
            relativeDueDays: 1,
            requiredEvidence: ['原始报告表', '患者基本信息'],
            description: '从各种来源（邮件、电话、文献）接收初始报告并完成登记。',
          },
          {
            id: 'n2',
            title: '数据完整性与随访',
            type: 'FOLLOWUP',
            defaultRole: 'PROCESSOR',
            relativeDueDays: 5,
            requiredEvidence: ['随访记录', '缺失信息追踪表'],
            description: '识别缺失字段，必要时进行 1-2 次随访。',
          },
          {
            id: 'n3',
            title: '医学审评与严重性评估',
            type: 'MEDICAL_REVIEW',
            defaultRole: 'PHYSICIAN',
            relativeDueDays: 8,
            requiredEvidence: ['医学意见书', '因果关系评估'],
            description: '由 Safety Physician 评估严重性、预期性、因果关系。',
          },
          {
            id: 'n4',
            title: '质量复核与偏差登记',
            type: 'QA_REVIEW',
            defaultRole: 'QA',
            relativeDueDays: 12,
            requiredEvidence: ['复核报告', '偏差/CAPA（如有）'],
            description: 'QA 核对必填证据、SOP 偏离情况。',
          },
          {
            id: 'n5',
            title: '监管提交与回执归档',
            type: 'SUBMISSION',
            defaultRole: 'PM',
            relativeDueDays: 15,
            requiredEvidence: ['E2B(R3) 文件', '监管回执'],
            description: '向 NMPA / FDA / EMA 提交并归档回执。',
          },
        ],
      },
      {
        id: 'tpl-inquiry',
        name: '监管问询响应模板',
        type: 'INQUIRY',
        description: '药监 / 卫生当局问询的响应流程：分派、医学评估、回复撰写、内部审批、提交。',
        reminderThresholds: [10, 5, 2],
        nodes: [
          { id: 'n1', title: '问询登记与责任分派', type: 'INTAKE', defaultRole: 'PM', relativeDueDays: 1, requiredEvidence: ['问询函扫描件'] },
          { id: 'n2', title: '医学与法规评估', type: 'MEDICAL_REVIEW', defaultRole: 'PHYSICIAN', relativeDueDays: 5, requiredEvidence: ['评估纪要', '支持文献'] },
          { id: 'n3', title: '回复函起草', type: 'DRAFT', defaultRole: 'PROCESSOR', relativeDueDays: 10, requiredEvidence: ['回复草稿', '附件清单'] },
          { id: 'n4', title: '内部审批与法务复核', type: 'QA_REVIEW', defaultRole: 'QA', relativeDueDays: 13, requiredEvidence: ['审批记录', '法务意见'] },
          { id: 'n5', title: '提交与回执归档', type: 'SUBMISSION', defaultRole: 'PM', relativeDueDays: 15, requiredEvidence: ['提交回执', '邮件留痕'] },
        ],
      },
      {
        id: 'tpl-capa',
        name: 'CAPA 整改闭环模板',
        type: 'CAPA',
        description: '审计或质量偏差触发的 CAPA 闭环：根因分析、行动计划、效果评估。',
        reminderThresholds: [7, 3, 1],
        nodes: [
          { id: 'n1', title: '偏差登记与影响评估', type: 'INTAKE', defaultRole: 'QA', relativeDueDays: 2, requiredEvidence: ['偏差描述', '影响范围评估'] },
          { id: 'n2', title: '根因分析', type: 'RCA', defaultRole: 'PM', relativeDueDays: 7, requiredEvidence: ['5-Why / 鱼骨图', '根因结论'] },
          { id: 'n3', title: 'CAPA 行动项制定', type: 'PLANNING', defaultRole: 'PM', relativeDueDays: 12, requiredEvidence: ['CAPA 计划', '责任人 / 时限'] },
          { id: 'n4', title: '执行与证据收集', type: 'EXECUTION', defaultRole: 'PROCESSOR', relativeDueDays: 25, requiredEvidence: ['执行记录', '培训记录'] },
          { id: 'n5', title: '效果评估与关闭', type: 'CLOSURE', defaultRole: 'QA', relativeDueDays: 30, requiredEvidence: ['效果评估报告', '关闭审批'] },
        ],
      },
    ],
  };
}
const store = g.__pvStore;

// 模板列表
router.get('/', (_req: Request, res: Response) => {
  res.json({ code: 0, data: store.templates });
});

// 模板详情
router.get('/:id', (req: Request, res: Response) => {
  const tpl = store.templates.find((t) => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ code: 404, message: 'template not found' });
  res.json({ code: 0, data: tpl });
});

// 更新模板
router.put('/:id', (req: Request, res: Response) => {
  const tpl = store.templates.find((t) => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ code: 404, message: 'template not found' });
  const { name, description, nodes, reminderThresholds } = req.body as Partial<Template>;
  if (name !== undefined) tpl.name = name;
  if (description !== undefined) tpl.description = description;
  if (nodes !== undefined) tpl.nodes = nodes;
  if (reminderThresholds !== undefined) tpl.reminderThresholds = reminderThresholds;
  res.json({ code: 0, data: tpl });
});

export default router;
