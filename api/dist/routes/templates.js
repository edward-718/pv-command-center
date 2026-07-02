/**
 * 模板管理 API
 * - GET  /api/templates           模板列表
 * - GET  /api/templates/:id      模板详情
 * - POST /api/templates          创建模板（仅 PM/ADMIN）
 * - PUT  /api/templates/:id      更新模板（仅 PM/ADMIN）
 * - DELETE /api/templates/:id   删除模板（仅 ADMIN）
 */
import { Router } from 'express';
import pvStore from '../store.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
const router = Router();
// 初始化默认模板
const defaultTemplates = [
    {
        id: 'tpl-icsr',
        name: 'ICSR 加速报告模板',
        type: 'ICSR',
        description: '针对 15 日 / 0 日个例安全报告的标准任务链，覆盖病例接收、医学审评、质量复核、监管提交。',
        reminderThresholds: [7, 3, 1],
        nodes: [
            { id: 'n1', title: '病例接收与编号登记', type: 'INTAKE', defaultRole: 'PROCESSOR', relativeDueDays: 1, requiredEvidence: ['原始报告表', '患者基本信息'], description: '从各种来源接收初始报告并完成登记。' },
            { id: 'n2', title: '数据完整性与随访', type: 'FOLLOWUP', defaultRole: 'PROCESSOR', relativeDueDays: 5, requiredEvidence: ['随访记录', '缺失信息追踪表'], description: '识别缺失字段，必要时进行 1-2 次随访。' },
            { id: 'n3', title: '医学审评与严重性评估', type: 'MEDICAL_REVIEW', defaultRole: 'PHYSICIAN', relativeDueDays: 8, requiredEvidence: ['医学意见书', '因果关系评估'], description: '由 Safety Physician 评估严重性、预期性、因果关系。' },
            { id: 'n4', title: '质量复核与偏差登记', type: 'QA_REVIEW', defaultRole: 'QA', relativeDueDays: 12, requiredEvidence: ['复核报告', '偏差/CAPA（如有）'], description: 'QA 核对必填证据、SOP 偏离情况。' },
            { id: 'n5', title: '监管提交与回执归档', type: 'SUBMISSION', defaultRole: 'PM', relativeDueDays: 15, requiredEvidence: ['E2B(R3) 文件', '监管回执'], description: '向 NMPA / FDA / EMA 提交并归档回执。' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'tpl-psur',
        name: 'PSUR 定期安全更新报告模板',
        type: 'PSUR',
        description: '定期安全更新报告的编写流程：数据收集、医学评估、质量审核、监管提交。',
        reminderThresholds: [14, 7, 3],
        nodes: [
            { id: 'n1', title: '数据收集与汇总', type: 'DATA_COLLECTION', defaultRole: 'PROCESSOR', relativeDueDays: 30, requiredEvidence: ['安全性数据汇总', '文献检索报告'] },
            { id: 'n2', title: '医学评估与信号检测', type: 'MEDICAL_REVIEW', defaultRole: 'PHYSICIAN', relativeDueDays: 50, requiredEvidence: ['医学评估报告', '信号分析'] },
            { id: 'n3', title: 'PSUR 草案撰写', type: 'DRAFT', defaultRole: 'PROCESSOR', relativeDueDays: 60, requiredEvidence: ['PSUR 草案', '参考文献列表'] },
            { id: 'n4', title: '质量审核', type: 'QA_REVIEW', defaultRole: 'QA', relativeDueDays: 65, requiredEvidence: ['审核记录', '修改痕迹'] },
            { id: 'n5', title: '监管提交', type: 'SUBMISSION', defaultRole: 'PM', relativeDueDays: 70, requiredEvidence: ['最终版 PSUR', '提交回执'] },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];
// 如果存储中无模板，初始化默认模板
if (pvStore.templates.length === 0) {
    pvStore.templates.push(...defaultTemplates);
    pvStore.save();
}
// 模板列表
router.get('/', authenticate, async (_req, res, next) => {
    try {
        res.json({ code: 0, data: pvStore.templates });
    }
    catch (err) {
        next(err);
    }
});
// 模板详情
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const tpl = pvStore.templates.find((t) => t.id === req.params.id);
        if (!tpl)
            return res.status(404).json({ code: 404, message: 'template not found' });
        res.json({ code: 0, data: tpl });
    }
    catch (err) {
        next(err);
    }
});
// 创建模板
router.post('/', authenticate, requirePermission('template:update'), async (req, res, next) => {
    try {
        const { name, type, description, nodes, reminderThresholds } = req.body;
        if (!name || !type || !nodes || nodes.length === 0) {
            return res.status(400).json({ code: 400, message: 'name, type, nodes required' });
        }
        const template = {
            id: `tpl-${Date.now()}`,
            name,
            type,
            description: description || '',
            nodes: nodes.map((n, i) => ({
                ...n,
                id: n.id || `n${i + 1}`,
            })),
            reminderThresholds: reminderThresholds || [7, 3, 1],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        pvStore.templates.unshift(template);
        pvStore.addAuditLog({
            id: `l-${Date.now()}`,
            actorId: req.user?.id || 'system',
            objectType: 'TEMPLATE',
            objectId: template.id,
            action: `创建模板 ${name}`,
            before: null,
            after: template,
            createdAt: new Date().toISOString(),
        });
        pvStore.save();
        res.json({ code: 0, data: template });
    }
    catch (err) {
        next(err);
    }
});
// 更新模板
router.put('/:id', authenticate, requirePermission('template:update'), async (req, res, next) => {
    try {
        const tpl = pvStore.templates.find((t) => t.id === req.params.id);
        if (!tpl)
            return res.status(404).json({ code: 404, message: 'template not found' });
        const { name, description, nodes, reminderThresholds } = req.body;
        const before = { ...tpl };
        if (name !== undefined)
            tpl.name = name;
        if (description !== undefined)
            tpl.description = description;
        if (nodes !== undefined)
            tpl.nodes = nodes;
        if (reminderThresholds !== undefined)
            tpl.reminderThresholds = reminderThresholds;
        tpl.updatedAt = new Date().toISOString();
        pvStore.addAuditLog({
            id: `l-${Date.now()}`,
            actorId: req.user?.id || 'system',
            objectType: 'TEMPLATE',
            objectId: tpl.id,
            action: `更新模板`,
            before,
            after: tpl,
            createdAt: new Date().toISOString(),
        });
        pvStore.save();
        res.json({ code: 0, data: tpl });
    }
    catch (err) {
        next(err);
    }
});
// 删除模板（仅 ADMIN）
router.delete('/:id', authenticate, requirePermission('project:delete'), async (req, res, next) => {
    try {
        const index = pvStore.templates.findIndex((t) => t.id === req.params.id);
        if (index === -1)
            return res.status(404).json({ code: 404, message: 'template not found' });
        const tpl = pvStore.templates[index];
        if (['tpl-icsr', 'tpl-inquiry', 'tpl-capa', 'tpl-psur'].includes(tpl.id)) {
            return res.status(400).json({ code: 400, message: 'cannot delete default template' });
        }
        pvStore.addAuditLog({
            id: `l-${Date.now()}`,
            actorId: req.user?.id || 'system',
            objectType: 'TEMPLATE',
            objectId: tpl.id,
            action: `删除模板 ${tpl.name}`,
            before: tpl,
            after: null,
            createdAt: new Date().toISOString(),
        });
        pvStore.templates.splice(index, 1);
        pvStore.save();
        res.json({ code: 0, data: { message: 'template deleted' } });
    }
    catch (err) {
        next(err);
    }
});
export default router;
