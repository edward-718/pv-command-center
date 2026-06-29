/**
 * 驾驶舱与 KPI API
 * - GET /api/dashboard       驾驶舱统计数据
 * - GET /api/dashboard/kpis   KPIs 详细指标
 */
import { Router } from 'express';
import pvStore from '../store.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
// 驾驶舱统计数据
router.get('/', authenticate, (req, res) => {
    const user = req.user;
    const tasks = Array.from(pvStore.tasks.values());
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    // 用户可见的任务
    const visibleTasks = tasks.filter((t) => {
        if (user.role === 'ADMIN' || user.role === 'QA')
            return true;
        if (user.role === 'VENDOR')
            return t.assigneeId === user.id;
        return true;
    });
    // KPI 计算
    const totalTasks = visibleTasks.length;
    const doneTasks = visibleTasks.filter((t) => t.status === 'DONE').length;
    const inProgressTasks = visibleTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const inReviewTasks = visibleTasks.filter((t) => t.status === 'IN_REVIEW').length;
    const overdueTasks = visibleTasks.filter((t) => {
        const due = new Date(t.dueAt).getTime();
        return due < now && t.status !== 'DONE';
    });
    const todayDueTasks = visibleTasks.filter((t) => {
        const due = new Date(t.dueAt).getTime();
        return due >= today.getTime() && due <= todayEnd.getTime();
    });
    // 按风险等级统计
    const highRiskTasks = visibleTasks.filter((t) => t.riskLevel === 'HIGH' || t.priority === 'P0');
    const overdueHighRisk = highRiskTasks.filter((t) => {
        const due = new Date(t.dueAt).getTime();
        return due < now && t.status !== 'DONE';
    });
    // 按优先级统计
    const priorityStats = {
        P0: visibleTasks.filter((t) => t.priority === 'P0').length,
        P1: visibleTasks.filter((t) => t.priority === 'P1').length,
        P2: visibleTasks.filter((t) => t.priority === 'P2').length,
    };
    // 按状态统计
    const statusStats = {
        NOT_STARTED: visibleTasks.filter((t) => t.status === 'NOT_STARTED').length,
        IN_PROGRESS: inProgressTasks,
        IN_REVIEW: inReviewTasks,
        NEEDS_INFO: visibleTasks.filter((t) => t.status === 'NEEDS_INFO').length,
        DONE: doneTasks,
    };
    // 按时限统计
    const deadlineStats = {
        overdue: overdueTasks.length,
        dueToday: todayDueTasks.length,
        dueThisWeek: visibleTasks.filter((t) => {
            const due = new Date(t.dueAt).getTime();
            const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
            return due >= now && due <= weekEnd;
        }).length,
        onTrack: totalTasks - overdueTasks.length,
    };
    // 证据完整度统计
    const tasksWithEvidence = visibleTasks.filter((t) => (t.requiredEvidence || []).length > 0);
    const tasksWithCompleteEvidence = tasksWithEvidence.filter((t) => {
        const required = t.requiredEvidence || [];
        const uploaded = t.evidenceUploaded || [];
        return required.length === 0 || required.every((e) => uploaded.includes(e));
    });
    const evidenceCompletenessRate = tasksWithEvidence.length > 0
        ? Math.round((tasksWithCompleteEvidence.length / tasksWithEvidence.length) * 100)
        : 100;
    // 项目统计
    const projects = pvStore.projects;
    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
    const closedProjects = projects.filter((p) => p.status === 'CLOSED').length;
    // 按项目类型统计
    const projectTypeStats = {};
    projects.forEach((p) => {
        const type = p.type || 'UNKNOWN';
        projectTypeStats[type] = (projectTypeStats[type] || 0) + 1;
    });
    res.json({
        code: 0,
        data: {
            overview: {
                totalTasks,
                doneTasks,
                inProgressTasks,
                overdueTasks: overdueTasks.length,
                completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
            },
            taskMetrics: {
                byPriority: priorityStats,
                byStatus: statusStats,
                byDeadline: deadlineStats,
                evidenceCompletenessRate,
            },
            projectMetrics: {
                activeProjects,
                closedProjects,
                byType: projectTypeStats,
            },
            alerts: {
                overdueHighRisk: overdueHighRisk.length,
                urgentTasks: highRiskTasks.filter((t) => {
                    const due = new Date(t.dueAt).getTime();
                    return due < now + 24 * 60 * 60 * 1000 && t.status !== 'DONE';
                }).length,
                incompleteEvidence: tasksWithEvidence.length - tasksWithCompleteEvidence.length,
            },
            timestamp: new Date().toISOString(),
        },
    });
});
// KPI 详细指标
router.get('/kpis', authenticate, (req, res) => {
    const user = req.user;
    const tasks = Array.from(pvStore.tasks.values());
    const now = Date.now();
    const visibleTasks = tasks.filter((t) => {
        if (user.role === 'ADMIN' || user.role === 'QA')
            return true;
        if (user.role === 'VENDOR')
            return t.assigneeId === user.id;
        return true;
    });
    // 北极星指标：按时完成率
    const completedTasks = visibleTasks.filter((t) => t.status === 'DONE');
    const onTimeCompleted = completedTasks.filter((t) => {
        const updated = new Date(t.updatedAt).getTime();
        const due = new Date(t.dueAt).getTime();
        return updated <= due;
    });
    const onTimeRate = completedTasks.length > 0
        ? Math.round((onTimeCompleted.length / completedTasks.length) * 100)
        : 100;
    // 过程指标
    const submittedForReview = visibleTasks.filter((t) => ['IN_REVIEW', 'NEEDS_INFO', 'DONE'].includes(t.status));
    const returnedTasks = visibleTasks.filter((t) => t.status === 'NEEDS_INFO');
    const returnRate = submittedForReview.length > 0
        ? Math.round((returnedTasks.length / submittedForReview.length) * 100)
        : 0;
    // P0 响应率
    const p0Tasks = visibleTasks.filter((t) => t.priority === 'P0');
    const p0Responded = p0Tasks.filter((t) => t.status !== 'NOT_STARTED');
    const p0ResponseRate = p0Tasks.length > 0
        ? Math.round((p0Responded.length / p0Tasks.length) * 100)
        : 100;
    // 逾期任务数
    const overdueCount = visibleTasks.filter((t) => {
        const due = new Date(t.dueAt).getTime();
        return due < now && t.status !== 'DONE';
    }).length;
    // 高风险任务逾期率
    const highRiskTasks = visibleTasks.filter((t) => t.riskLevel === 'HIGH' || t.priority === 'P0');
    const overdueHighRisk = highRiskTasks.filter((t) => {
        const due = new Date(t.dueAt).getTime();
        return due < now && t.status !== 'DONE';
    });
    const highRiskOverdueRate = highRiskTasks.length > 0
        ? Math.round((overdueHighRisk.length / highRiskTasks.length) * 100)
        : 0;
    // 证据完整度
    const tasksWithEvidence = visibleTasks.filter((t) => (t.requiredEvidence || []).length > 0);
    const tasksWithCompleteEvidence = tasksWithEvidence.filter((t) => {
        const required = t.requiredEvidence || [];
        const uploaded = t.evidenceUploaded || [];
        return required.length === 0 || required.every((e) => uploaded.includes(e));
    });
    const evidenceCompleteness = tasksWithEvidence.length > 0
        ? Math.round((tasksWithCompleteEvidence.length / tasksWithEvidence.length) * 100)
        : 100;
    res.json({
        code: 0,
        data: {
            northStar: {
                name: '任务按时完成率',
                value: onTimeRate,
                unit: '%',
                target: 85,
                description: '已完成且完成时间 ≤ 截止时间的任务占比',
            },
            processMetrics: {
                taskReturnRate: {
                    name: '任务复核退回率',
                    value: returnRate,
                    unit: '%',
                    description: '进入"需补充"状态的任务数 / 提交复核的任务总数',
                },
                p0ResponseRate: {
                    name: 'P0 紧急任务响应率',
                    value: p0ResponseRate,
                    unit: '%',
                    description: 'P0 任务在 24 小时内被处理的任务数 / P0 任务总数',
                },
                highRiskOverdueRate: {
                    name: '高风险任务逾期率',
                    value: highRiskOverdueRate,
                    unit: '%',
                    description: '高风险逾期任务数 / 高风险任务总数',
                },
                evidenceCompleteness: {
                    name: '审计证据完整度',
                    value: evidenceCompleteness,
                    unit: '%',
                    description: '必填证据已上传的任务数 / 有必填证据要求的任务总数',
                },
            },
            currentStats: {
                overdueTasks: overdueCount,
                highRiskOverdue: overdueHighRisk.length,
                incompleteEvidence: tasksWithEvidence.length - tasksWithCompleteEvidence.length,
            },
            timestamp: new Date().toISOString(),
        },
    });
});
export default router;
