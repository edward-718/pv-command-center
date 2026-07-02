import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SEED } from '@/data/seed';
import { calculateRegulatoryDeadline, canTransition, getMissingEvidence } from '@/lib/utils';
import type {
  User,
  Project,
  Task,
  Comment,
  Attachment,
  AuditLog,
  Review,
  Template,
  Notification,
  AIDraft,
  Activity,
  TaskStatus,
  Role,
  SavedFilter,
  CSVImportReport,
  RiskLevel,
} from '@/types';

type ToastEntry = {
  id: string;
  kind: 'success' | 'error' | 'info';
  message: string;
};

type Store = {
  // 状态
  currentUser: User | null;
  users: User[];
  projects: Project[];
  tasks: Task[];
  comments: Comment[];
  attachments: Attachment[];
  reviews: Review[];
  templates: Template[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  aiDrafts: AIDraft[];
  activities: Activity[];
  savedFilters: SavedFilter[];
  toasts: ToastEntry[];

  // 认证
  login: (userId: string) => void;
  logout: () => void;
  switchUser: (userId: string) => void;

  // 任务
  updateTaskStatus: (taskId: string, status: TaskStatus, reason?: string) => void;
  updateTaskField: (taskId: string, field: keyof Task, value: unknown) => void;
  addComment: (taskId: string, content: string, mentions: string[]) => void;
  uploadAttachment: (taskId: string, fileName: string, size: number, type: string, evidenceKey?: string) => void;
  deleteAttachment: (attachmentId: string) => void;
  reviewTask: (taskId: string, decision: 'APPROVED' | 'RETURNED', reason?: string) => void;
  createTaskFromTemplate: (projectId: string, templateId: string) => void;
  createProjectFromTemplate: (input: {
    name: string;
    code: string;
    type: Project['type'];
    product: string;
    region: string;
    description: string;
    templateId: string;
    dayZero?: string;
    regulatoryRule?: Project['regulatoryRule'];
    caseType?: Project['caseType'];
  }) => Project | null;
  saveMedicalAssessment: (taskId: string, data: {
    seriousness?: Task['seriousness'];
    severity?: Task['severity'];
    causality?: Task['causality'];
    meddraPt?: string;
    meddraLlt?: string;
    medicalOpinion?: string;
    signalFlag?: boolean;
  }) => void;
  createFollowUpTask: (originalTaskId: string) => Task | null;

  // 监管提交
  saveSubmission: (projectId: string, submission: Omit<import('@/types').Submission, 'id' | 'projectId' | 'createdBy' | 'createdAt' | 'updatedAt'> & { id?: string }) => import('@/types').Submission | null;
  deleteSubmission: (projectId: string, submissionId: string) => void;

  // 通知
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId: string) => void;
  generateNotifications: () => void;

  // AI
  saveAIDraft: (projectId: string, kind: AIDraft['kind'], content: string) => void;
  confirmAIDraft: (id: string) => void;

  // 模板
  updateTemplate: (id: string, patch: Partial<Template>) => void;

  // 活动记录
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;

  // Toast
  pushToast: (kind: ToastEntry['kind'], message: string) => void;
  dismissToast: (id: string) => void;

  // 第三阶段：批量操作
  batchUpdateTasks: (taskIds: string[], action: { type: 'assign'; assigneeId: string } | { type: 'risk'; riskLevel: RiskLevel } | { type: 'dueDate'; deltaDays: number }) => void;

  // 第三阶段：保存/删除筛选
  saveFilter: (name: string, conditions: SavedFilter['conditions']) => void;
  deleteFilter: (id: string) => void;

  // 第三阶段：CSV 导入
  importTasksFromCSV: (rows: Record<string, string>[], mapping: Record<string, keyof Task>) => CSVImportReport;

  // 第三阶段：CSV 导出审计
  logCSVExport: (count: number) => void;

  // 数据
  resetData: () => void;
};

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: SEED.users,
      projects: SEED.projects,
      tasks: SEED.tasks,
      comments: SEED.comments,
      attachments: SEED.attachments,
      reviews: SEED.reviews,
      templates: SEED.templates,
      notifications: SEED.notifications,
      auditLogs: SEED.auditLogs,
      aiDrafts: SEED.aiDrafts,
      activities: SEED.activities || [],
      savedFilters: [],
      toasts: [],

      login: (userId) => {
        const user = get().users.find((u) => u.id === userId);
        if (user) {
          set({ currentUser: user });
          get().pushToast('success', `已登录为 ${user.name}（${user.role}）`);
        }
      },

      logout: () => {
        set({ currentUser: null });
      },

      switchUser: (userId) => {
        const user = get().users.find((u) => u.id === userId);
        if (user) {
          set({ currentUser: user });
          get().pushToast('info', `已切换到 ${user.name}（${user.role}）`);
        }
      },

      updateTaskStatus: (taskId, status, reason) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        const me = get().currentUser;
        if (!me) return;
        if (task.blocked) {
          get().pushToast('error', '任务被阻塞，前置任务未完成，无法修改状态');
          return;
        }
        if (!canTransition(task.status, status)) {
          get().pushToast('error', `状态不能从 ${task.status} 变更为 ${status}`);
          return;
        }
        const isAssignee = me.id === task.assigneeId;
        const isReviewer = me.id === task.reviewerId;
        const canEdit = isAssignee || isReviewer || me.role === 'PM' || me.role === 'ADMIN';
        if (!canEdit) {
          get().pushToast('error', '权限不足，无法修改任务状态');
          return;
        }
        if (status === 'DONE' && !isReviewer && me.role !== 'PM' && me.role !== 'ADMIN') {
          get().pushToast('error', '提交至"已完成"需要由复核人确认，不能直接修改');
          return;
        }
        const before = { ...task };
        const now = new Date().toISOString();
        const updated: Task = { ...task, status, updatedAt: now };
        const statusLabel: Record<string, string> = {
          NOT_STARTED: '未开始',
          IN_PROGRESS: '处理中',
          IN_REVIEW: '待复核',
          NEEDS_INFO: '需补充',
          DONE: '已完成',
        };
        const allTasks = get().tasks;
        const dependentTasks = allTasks.filter(
          (t) => t.projectId === task.projectId && t.dependsOn?.includes(task.id),
        );
        const unblockedTasks = dependentTasks.map((dt) => {
          const remainingDeps = dt.dependsOn.filter(
            (depId) => depId !== task.id && allTasks.find((t) => t.id === depId && t.status !== 'DONE'),
          );
          return { ...dt, blocked: remainingDeps.length > 0, updatedAt: now };
        });
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: task.projectId,
          taskId,
          type: 'TASK_STATUS',
          content: `${statusLabel[before.status] ?? before.status} → ${statusLabel[status] ?? status}「${task.title}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'TASK' as const,
          objectId: taskId,
          action: `更新状态 ${before.status} → ${status}${reason ? `（${reason}）` : ''}`,
          before,
          after: updated,
          createdAt: now,
        };
        const finalTasks = allTasks
          .map((t) => (t.id === taskId ? updated : t))
          .map((t) => {
            const unblocked = unblockedTasks.find((u) => u.id === t.id);
            return unblocked ?? t;
          });
        const projectTasks = finalTasks.filter((t) => t.projectId === task.projectId);
        const completedCount = projectTasks.filter((t) => t.status === 'DONE').length;
        const progress = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;
        const updatedProjects = get().projects.map((p) =>
          p.id === task.projectId ? { ...p, progress, updatedAt: now } : p,
        );
        const existingNotifications = get().notifications;
        const unblockedNotifications: Notification[] = unblockedTasks
          .filter((ut, i) => {
            const original = dependentTasks[i];
            return original?.blocked && !ut.blocked;
          })
          .map((ut) => {
            const notifUserId = ut.assigneeId ?? get().projects.find((p) => p.id === ut.projectId)?.ownerId ?? 'u-001';
            const key = `${notifUserId}-${ut.id}-TASK-unblocked`;
            const exists = existingNotifications.some((n) => {
              const age = new Date(now).getTime() - new Date(n.createdAt).getTime();
              return (
                age < 24 * 60 * 60 * 1000 &&
                n.category === 'TASK' &&
                n.content.startsWith('【阻塞解除】') &&
                `${n.userId}-${n.source}-TASK-unblocked` === key
              );
            });
            if (exists) return null;
            return {
              id: uid('n'),
              userId: notifUserId,
              source: ut.id,
              category: 'TASK',
              content: `【阻塞解除】前置任务已完成，「${ut.title}」可以开始处理了`,
              status: 'UNREAD',
              createdAt: now,
            };
          })
          .filter((n): n is Notification => n !== null);
        set({
          tasks: finalTasks,
          projects: updatedProjects,
          activities: [newActivity, ...get().activities].slice(0, 100),
          auditLogs: [newAuditLog, ...get().auditLogs],
          notifications: [...unblockedNotifications, ...existingNotifications].slice(0, 200),
        });
        get().generateNotifications();
      },

      updateTaskField: (taskId, field, value) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        const me = get().currentUser;
        if (!me) return;
        if (task.blocked) {
          get().pushToast('error', '任务被阻塞，无法修改');
          return;
        }
        if (field === 'status') {
          get().pushToast('error', '请使用 updateTaskStatus 方法变更任务状态');
          return;
        }
        if (field === 'medicalOpinion' && me.role !== 'PHYSICIAN' && me.role !== 'PM' && me.role !== 'ADMIN') {
          get().pushToast('error', '权限不足，只有医学人员可以修改医学意见');
          return;
        }
        if (field === 'followUpStatus' && me.role !== 'PROCESSOR' && me.role !== 'PM' && me.role !== 'ADMIN' && me.id !== task.assigneeId) {
          get().pushToast('error', '权限不足，无法修改随访状态');
          return;
        }
        if (field === 'followUpRecords' && me.role !== 'PROCESSOR' && me.role !== 'PM' && me.role !== 'ADMIN' && me.role !== 'PHYSICIAN') {
          get().pushToast('error', '权限不足，无法修改随访记录');
          return;
        }
        const isAssignee = me.id === task.assigneeId;
        const isReviewer = me.id === task.reviewerId;
        const hasFieldPermission = field === 'medicalOpinion' || field === 'followUpStatus' || field === 'followUpRecords';
        const canEdit = hasFieldPermission || isAssignee || isReviewer || me.role === 'PM' || me.role === 'ADMIN';
        if (!canEdit) {
          get().pushToast('error', '权限不足，无法修改任务字段');
          return;
        }
        const before = { ...task };
        const now = new Date().toISOString();
        const updated: Task = { ...task, [field]: value, updatedAt: now };
        const fieldLabel: Record<string, string> = {
          title: '标题',
          description: '描述',
          priority: '优先级',
          dueAt: '截止日期',
          assigneeId: '负责人',
          reviewerId: '复核人',
          medicalOpinion: '医学意见',
          followUpStatus: '随访状态',
          riskLevel: '风险等级',
        };
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: task.projectId,
          taskId,
          type: 'TASK_EDIT',
          content: `更新「${task.title}」的${fieldLabel[String(field)] ?? String(field)}`,
          createdAt: now,
        };
        const state = get();
        set({
          tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [
            {
              id: uid('l'),
              actorId: me.id,
              objectType: 'TASK' as const,
              objectId: taskId,
              action: `更新字段 ${String(field)}`,
              before,
              after: updated,
              createdAt: now,
            },
            ...state.auditLogs,
          ],
        });
        get().generateNotifications();
      },

      addComment: (taskId, content, mentions) => {
        const me = get().currentUser;
        if (!me) return;
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) {
          get().pushToast('error', '任务不存在');
          return;
        }
        if (task.blocked) {
          get().pushToast('error', '任务被阻塞，无法添加评论');
          return;
        }
        const isAssignee = me.id === task.assigneeId;
        const isReviewer = me.id === task.reviewerId;
        const project = get().projects.find((p) => p.id === task.projectId);
        const isProjectMember = project?.memberIds.includes(me.id) || project?.ownerId === me.id;
        const canComment = isAssignee || isReviewer || isProjectMember || me.role === 'PM' || me.role === 'ADMIN' || me.role === 'QA';
        if (!canComment) {
          get().pushToast('error', '权限不足，无法添加评论');
          return;
        }
        const now = new Date().toISOString();
        const c: Comment = {
          id: uid('c'),
          taskId,
          authorId: me.id,
          content,
          mentions,
          createdAt: now,
        };
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: task.projectId,
          taskId,
          type: 'COMMENT',
          content: `在「${task.title}」发表评论`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'TASK' as const,
          objectId: taskId,
          action: '发表评论',
          after: c,
          createdAt: now,
        };
        const state = get();
        const commentNotifications: Notification[] = [];
        const notifiedUsers = new Set<string>();
        if (mentions && mentions.length > 0) {
          mentions.forEach((userId) => {
            if (userId !== me.id && !notifiedUsers.has(userId)) {
              commentNotifications.push({
                id: uid('n'),
                userId,
                source: taskId,
                category: 'MENTION',
                content: `【有人@你】${me.name} 在「${task.title}」中提到了你`,
                status: 'UNREAD',
                createdAt: now,
              });
              notifiedUsers.add(userId);
            }
          });
        }
        if (task.assigneeId && task.assigneeId !== me.id && !notifiedUsers.has(task.assigneeId)) {
          commentNotifications.push({
            id: uid('n'),
            userId: task.assigneeId,
            source: taskId,
            category: 'COMMENT',
            content: `【新评论】${me.name} 在「${task.title}」发表了评论`,
            status: 'UNREAD',
            createdAt: now,
          });
          notifiedUsers.add(task.assigneeId);
        }
        if (task.reviewerId && task.reviewerId !== me.id && !notifiedUsers.has(task.reviewerId)) {
          commentNotifications.push({
            id: uid('n'),
            userId: task.reviewerId,
            source: taskId,
            category: 'COMMENT',
            content: `【新评论】${me.name} 在「${task.title}」发表了评论`,
            status: 'UNREAD',
            createdAt: now,
          });
          notifiedUsers.add(task.reviewerId);
        }
        set({
          comments: [c, ...state.comments],
          activities: [newActivity, ...state.activities].slice(0, 100),
          notifications: [...commentNotifications, ...state.notifications].slice(0, 200),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', '评论已发布');
        get().generateNotifications();
      },

      uploadAttachment: (taskId, fileName, size, type, evidenceKey) => {
        const me = get().currentUser;
        if (!me) return;
        if (!roleCan(me.role, 'upload')) {
          get().pushToast('error', '权限不足，无法上传附件');
          return;
        }
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) {
          get().pushToast('error', '任务不存在，无法上传附件');
          return;
        }
        if (task.blocked) {
          get().pushToast('error', '任务被阻塞，无法上传附件');
          return;
        }
        const now = new Date().toISOString();
        const att: Attachment = {
          id: uid('a'),
          taskId,
          fileName,
          size,
          type,
          version: 1,
          uploaderId: me.id,
          evidenceKey,
          createdAt: now,
        };
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: task.projectId,
          taskId,
          type: 'ATTACHMENT',
          content: `上传附件「${fileName}」到「${task.title}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'ATTACHMENT' as const,
          objectId: att.id,
          action: `上传附件 ${fileName}`,
          after: att,
          createdAt: now,
        };
        const state = get();
        const uploadNotifications: Notification[] = [];
        if (task.reviewerId && task.reviewerId !== me.id && evidenceKey) {
          uploadNotifications.push({
            id: uid('n'),
            userId: task.reviewerId,
            source: taskId,
            category: 'EVIDENCE',
            content: `【证据更新】${me.name} 在「${task.title}」上传了新证据：${fileName}`,
            status: 'UNREAD',
            createdAt: now,
          });
        }
        const updatedEvidenceUploaded = Array.from(new Set([...task.evidenceUploaded, att.id]));
        const missingAfter = getMissingEvidence(task.requiredEvidence, updatedEvidenceUploaded, state.attachments);
        if (missingAfter.length === 0 && task.requiredEvidence.length > 0 && task.reviewerId && task.reviewerId !== me.id) {
          uploadNotifications.push({
            id: uid('n'),
            userId: task.reviewerId,
            source: taskId,
            category: 'EVIDENCE',
            content: `【证据齐全】「${task.title}」的所有必需证据已上传完成`,
            status: 'UNREAD',
            createdAt: now,
          });
        }
        set({
          attachments: [att, ...state.attachments],
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  evidenceUploaded: updatedEvidenceUploaded,
                  updatedAt: now,
                }
              : t,
          ),
          activities: [newActivity, ...state.activities].slice(0, 100),
          notifications: [...uploadNotifications, ...state.notifications].slice(0, 200),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', `附件 ${fileName} 上传成功`);
        get().generateNotifications();
      },

      deleteAttachment: (attachmentId) => {
        const me = get().currentUser;
        if (!me) return;
        const att = get().attachments.find((a) => a.id === attachmentId);
        if (!att) return;
        const task = get().tasks.find((t) => t.id === att.taskId);
        if (!task) {
          get().pushToast('error', '关联任务不存在');
          return;
        }
        if (task.blocked) {
          get().pushToast('error', '任务被阻塞，无法删除附件');
          return;
        }
        const isUploader = me.id === att.uploaderId;
        const canDelete = isUploader || me.role === 'PM' || me.role === 'ADMIN';
        if (!canDelete) {
          get().pushToast('error', '权限不足，无法删除附件');
          return;
        }
        const now = new Date().toISOString();
        const state = get();
        const updatedAttachments = state.attachments.filter((a) => a.id !== attachmentId);
        const updatedTasks = state.tasks.map((t) =>
          t.id === att.taskId
            ? {
                ...t,
                evidenceUploaded: t.evidenceUploaded.filter((id) => id !== attachmentId),
                updatedAt: now,
              }
            : t,
        );
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: task.projectId,
          taskId: att.taskId,
          type: 'ATTACHMENT',
          content: `删除附件「${att.fileName}」从「${task.title}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'ATTACHMENT' as const,
          objectId: attachmentId,
          action: `删除附件 ${att.fileName}`,
          before: att,
          createdAt: now,
        };
        set({
          attachments: updatedAttachments,
          tasks: updatedTasks,
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', `附件 ${att.fileName} 已删除`);
        get().generateNotifications();
      },

      reviewTask: (taskId, decision, reason) => {
        const me = get().currentUser;
        if (!me) return;
        if (!roleCan(me.role, 'review')) {
          get().pushToast('error', '权限不足，无法进行复核操作');
          return;
        }
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        if (task.blocked) {
          get().pushToast('error', '任务被阻塞，无法进行复核操作');
          return;
        }
        if (task.status !== 'IN_REVIEW') {
          get().pushToast('error', '只有待复核状态的任务才能进行复核操作');
          return;
        }
        const isReviewer = me.id === task.reviewerId;
        if (!isReviewer && me.role !== 'PM' && me.role !== 'ADMIN') {
          get().pushToast('error', '只有指定复核人才能执行复核操作');
          return;
        }
        const now = new Date().toISOString();
        const review: Review = {
          id: uid('r'),
          taskId,
          reviewerId: me.id,
          decision,
          reason,
          createdAt: now,
        };
        const nextStatus: TaskStatus = decision === 'APPROVED' ? 'DONE' : 'NEEDS_INFO';
        const state = get();
        let updatedTasks = state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: nextStatus, updatedAt: now } : t,
        );
        let unblockedNotifications: Notification[] = [];
        if (nextStatus === 'DONE') {
          const dependentTasks = updatedTasks.filter(
            (t) => t.projectId === task.projectId && t.dependsOn?.includes(taskId),
          );
          const unblockedTasks = dependentTasks.map((dt) => {
            const remainingDeps = dt.dependsOn.filter(
              (depId) => depId !== taskId && updatedTasks.find((t) => t.id === depId && t.status !== 'DONE'),
            );
            return { ...dt, blocked: remainingDeps.length > 0, updatedAt: now };
          });
          updatedTasks = updatedTasks.map((t) => {
            const unblocked = unblockedTasks.find((u) => u.id === t.id);
            return unblocked ?? t;
          });
          unblockedNotifications = unblockedTasks
            .filter((ut, i) => {
              const original = dependentTasks[i];
              return original?.blocked && !ut.blocked;
            })
            .map((ut) => {
              const notifUserId = ut.assigneeId ?? state.projects.find((p) => p.id === ut.projectId)?.ownerId ?? 'u-001';
              const key = `${notifUserId}-${ut.id}-TASK-unblocked`;
              const exists = state.notifications.some((n) => {
                const age = new Date(now).getTime() - new Date(n.createdAt).getTime();
                return (
                  age < 24 * 60 * 60 * 1000 &&
                  n.category === 'TASK' &&
                  n.content.startsWith('【阻塞解除】') &&
                  `${n.userId}-${n.source}-TASK-unblocked` === key
                );
              });
              if (exists) return null;
              return {
                id: uid('n'),
                userId: notifUserId,
                source: ut.id,
                category: 'TASK',
                content: `【阻塞解除】前置任务已完成，「${ut.title}」可以开始处理了`,
                status: 'UNREAD',
                createdAt: now,
              };
            })
            .filter((n): n is Notification => n !== null);
        }
        const projectTasks = updatedTasks.filter((t) => t.projectId === task.projectId);
        const completedCount = projectTasks.filter((t) => t.status === 'DONE').length;
        const progress = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;
        const updatedProjects = state.projects.map((p) =>
          p.id === task.projectId ? { ...p, progress, updatedAt: now } : p,
        );
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: task.projectId,
          taskId,
          type: 'TASK_REVIEW',
          content: `${decision === 'APPROVED' ? '复核通过' : '复核退回'}「${task.title}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'REVIEW' as const,
          objectId: review.id,
          action: decision === 'APPROVED' ? '复核通过' : `复核退回${reason ? `：${reason}` : ''}`,
          after: review,
          createdAt: now,
        };
        set({
          reviews: [review, ...state.reviews],
          tasks: updatedTasks,
          projects: updatedProjects,
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
          notifications: [...unblockedNotifications, ...state.notifications].slice(0, 200),
        });
        get().pushToast(
          decision === 'APPROVED' ? 'success' : 'info',
          decision === 'APPROVED' ? '已通过复核' : '已退回补充',
        );
        get().generateNotifications();
      },

      createTaskFromTemplate: (projectId, _templateId) => {
        // MVP: 不再生成任务，保留扩展位
        return;
      },

      createProjectFromTemplate: (input) => {
        const me = get().currentUser;
        if (!me || !roleCan(me.role, 'create_project')) {
          get().pushToast('error', '权限不足，无法创建项目');
          return null;
        }
        const tpl = get().templates.find((t) => t.id === input.templateId);
        if (!tpl) {
          get().pushToast('error', '模板不存在，无法创建项目');
          return null;
        }
        const id = uid('p');
        const now = new Date().toISOString();
        const project: Project = {
          id,
          name: input.name,
          code: input.code,
          type: input.type,
          product: input.product,
          region: input.region,
          description: input.description,
          ownerId: me.id,
          status: 'ACTIVE',
          startDate: now,
          templateId: input.templateId,
          memberIds: [me.id],
          progress: 0,
          dayZero: input.dayZero,
          regulatoryRule: input.regulatoryRule,
          caseType: input.caseType,
          followUpCount: 0,
          submissions: [],
        };
        const startMs = Date.now();
        const regulatoryDeadline = calculateRegulatoryDeadline(
          input.dayZero,
          input.regulatoryRule,
        );
        const templateNodes = tpl.nodes;
        const taskIdMap = new Map<string, string>();
        templateNodes.forEach((n) => {
          taskIdMap.set(n.id, uid('t'));
        });
        const newTasks: Task[] = templateNodes.map((n, i) => ({
          id: taskIdMap.get(n.id)!,
          projectId: id,
          title: n.title,
          description: n.description ?? '',
          type: n.type,
          status: 'NOT_STARTED' as TaskStatus,
          priority: i === 0 ? 'P0' : i < 2 ? 'P1' : 'P2',
          assigneeId: me.id,
          reviewerId: me.role === 'PM' ? me.id : 'u-001',
          dueAt: new Date(startMs + n.relativeDueDays * 24 * 60 * 60 * 1000).toISOString(),
          riskLevel: 'MEDIUM' as const,
          requiredEvidence: n.requiredEvidence,
          evidenceUploaded: [],
          product: input.product,
          region: input.region,
          dayZero: input.dayZero,
          severity: undefined,
          seriousness: undefined,
          causality: undefined,
          meddraPt: undefined,
          meddraLlt: undefined,
          createdAt: now,
          updatedAt: now,
          regulatoryDeadline,
          dependsOn: (n.dependsOn || []).map((depId) => taskIdMap.get(depId)!).filter(Boolean),
          blocked: (n.dependsOn || []).length > 0,
          signalFlag: false,
          followUpRound: 0,
          followUpRecords: [],
          followUpStatus: 'NONE' as const,
          medicalOpinion: '',
          customValues: {},
        }));
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: id,
          type: 'PROJECT_CREATE',
          content: `创建新项目「${input.name}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'PROJECT' as const,
          objectId: id,
          action: `从模板 ${tpl?.name ?? input.templateId} 创建项目 ${input.name}`,
          after: project,
          createdAt: now,
        };
        const state = get();
        set({
          projects: [project, ...state.projects],
          tasks: [...newTasks, ...state.tasks],
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', `项目「${input.name}」已创建，${newTasks.length} 个任务已生成`);
        get().generateNotifications();
        return project;
      },

      markNotificationRead: (id) => {
        const me = get().currentUser;
        if (!me) return;
        const notification = get().notifications.find((n) => n.id === id);
        if (!notification || notification.userId !== me.id) return;
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, status: 'READ' } : n,
          ),
        });
      },

      markAllNotificationsRead: (userId) => {
        const me = get().currentUser;
        if (!me || me.id !== userId) return;
        set({
          notifications: get().notifications.map((n) =>
            n.userId === userId ? { ...n, status: 'READ' } : n,
          ),
        });
      },

      generateNotifications: () => {
        const now = Date.now();
        const nowIso = new Date().toISOString();
        const newNotifications: Notification[] = [];
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const state = get();
        const { tasks, projects, attachments, notifications } = state;
        const existingRecent = new Set(
          notifications
            .filter((n) => {
              const age = now - new Date(n.createdAt).getTime();
              return age < TWENTY_FOUR_HOURS;
            })
            .map((n) => {
              let subType = '';
              if (n.category === 'DEADLINE' && n.content.startsWith('【即将到期】')) subType = 'soon';
              else if (n.category === 'DEADLINE' && n.content.startsWith('【紧急】')) subType = 'urgent';
              else if (n.category === 'REVIEW' && n.content.startsWith('【复核退回】')) subType = 'returned';
              else if (n.category === 'TASK' && n.content.startsWith('【阻塞解除】')) subType = 'unblocked';
              return `${n.userId}-${n.source}-${n.category}-${subType}`;
            }),
        );
        tasks.forEach((task) => {
          if (task.status === 'DONE') return;
          const project = projects.find((p) => p.id === task.projectId);
          const dueMs = new Date(task.dueAt).getTime();
          if (isNaN(dueMs)) return;
          const diffMs = dueMs - now;
          const diffHours = diffMs / (1000 * 60 * 60);
          const userId = task.assigneeId ?? project?.ownerId ?? 'u-001';

          const deadlineKey = `${userId}-${task.id}-DEADLINE-soon`;
          if (diffHours <= 24 && diffHours > 4 && !existingRecent.has(deadlineKey)) {
            newNotifications.push({
              id: uid('n'),
              userId,
              source: task.id,
              category: 'DEADLINE',
              content: `【即将到期】任务「${task.title}」将在 ${Math.ceil(diffHours)} 小时后截止`,
              status: 'UNREAD',
              createdAt: nowIso,
            });
            existingRecent.add(deadlineKey);
          }
          const urgentKey = `${userId}-${task.id}-DEADLINE-urgent`;
          if (diffHours <= 4 && diffHours > 0 && !existingRecent.has(urgentKey)) {
            newNotifications.push({
              id: uid('n'),
              userId,
              source: task.id,
              category: 'DEADLINE',
              content: `【紧急】任务「${task.title}」将在 ${Math.ceil(diffHours)} 小时后截止`,
              status: 'UNREAD',
              createdAt: nowIso,
            });
            existingRecent.add(urgentKey);
          }
          const overdueKey = `${userId}-${task.id}-OVERDUE-`;
          if (diffMs < 0 && !existingRecent.has(overdueKey)) {
            const overdueHours = Math.floor(Math.abs(diffHours));
            newNotifications.push({
              id: uid('n'),
              userId,
              source: task.id,
              category: 'OVERDUE',
              content: `【已逾期】任务「${task.title}」已逾期 ${overdueHours} 小时`,
              status: 'UNREAD',
              createdAt: nowIso,
            });
            existingRecent.add(overdueKey);
          }
          const reviewKey = `${task.assigneeId ?? 'u-001'}-${task.id}-REVIEW-returned`;
          if (task.status === 'NEEDS_INFO' && !existingRecent.has(reviewKey)) {
            newNotifications.push({
              id: uid('n'),
              userId: task.assigneeId ?? 'u-001',
              source: task.id,
              category: 'REVIEW',
              content: `【复核退回】任务「${task.title}」被退回，需补充信息`,
              status: 'UNREAD',
              createdAt: nowIso,
            });
            existingRecent.add(reviewKey);
          }
          const missingEvidence = getMissingEvidence(task.requiredEvidence, task.evidenceUploaded, attachments);
          const evidenceKey = `${userId}-${task.id}-EVIDENCE-`;
          if (
            missingEvidence.length > 0 &&
            diffHours <= 24 &&
            diffHours > 0 &&
            !existingRecent.has(evidenceKey)
          ) {
            newNotifications.push({
              id: uid('n'),
              userId,
              source: task.id,
              category: 'EVIDENCE',
              content: `【证据缺失】任务「${task.title}」缺少 ${missingEvidence.length} 项必填证据`,
              status: 'UNREAD',
              createdAt: nowIso,
            });
            existingRecent.add(evidenceKey);
          }
        });
        if (newNotifications.length > 0) {
          set({ notifications: [...newNotifications, ...get().notifications].slice(0, 200) });
        }
      },

      saveAIDraft: (projectId, kind, content) => {
        const me = get().currentUser;
        if (!me) return;
        const project = get().projects.find((p) => p.id === projectId);
        if (!project) {
          get().pushToast('error', '项目不存在，无法保存草稿');
          return;
        }
        const visibleProjects = selectVisibleProjects(get(), me);
        if (!visibleProjects.some((p) => p.id === projectId)) {
          get().pushToast('error', '权限不足，无法保存该项目的草稿');
          return;
        }
        const now = new Date().toISOString();
        const draft: AIDraft = {
          id: uid('aig'),
          projectId,
          kind,
          content,
          createdAt: now,
          confirmed: false,
          authorId: me.id,
        };
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId,
          type: 'AI_DRAFT' as const,
          content: `保存AI草稿「${kind}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'AI_DRAFT' as const,
          objectId: draft.id,
          action: '保存AI草稿',
          after: draft,
          createdAt: now,
        };
        const state = get();
        set({
          aiDrafts: [draft, ...state.aiDrafts],
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', 'AI 草稿已保存');
      },

      confirmAIDraft: (id) => {
        const me = get().currentUser;
        if (!me) return;
        if (!roleCan(me.role, 'confirm_ai')) {
          get().pushToast('error', '权限不足，无法确认AI草稿');
          return;
        }
        const draft = get().aiDrafts.find((d) => d.id === id);
        if (!draft) return;
        const visibleProjects = selectVisibleProjects(get(), me);
        if (!visibleProjects.some((p) => p.id === draft.projectId)) {
          get().pushToast('error', '权限不足，无法确认该项目的草稿');
          return;
        }
        const now = new Date().toISOString();
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: draft.projectId,
          type: 'AI_DRAFT' as const,
          content: `确认AI草稿「${draft.kind}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'AI_DRAFT' as const,
          objectId: id,
          action: '确认AI草稿',
          before: draft,
          after: { ...draft, confirmed: true },
          createdAt: now,
        };
        const state = get();
        set({
          aiDrafts: state.aiDrafts.map((d) => (d.id === id ? { ...d, confirmed: true } : d)),
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', 'AI 草稿已确认为正式记录');
      },

      addActivity: (activity) => {
        const now = new Date().toISOString();
        const newActivity: Activity = {
          ...activity,
          id: uid('act'),
          createdAt: now,
        };
        const all = [newActivity, ...get().activities];
        set({ activities: all.slice(0, 100) });
      },

      updateTemplate: (id, patch) => {
        const me = get().currentUser;
        if (!me) return;
        if (!roleCan(me.role, 'edit_template')) {
          get().pushToast('error', '权限不足，无法修改模板');
          return;
        }
        const tpl = get().templates.find((t) => t.id === id);
        if (!tpl) return;
        const now = new Date().toISOString();
        const before = { ...tpl };
        const updated = { ...tpl, ...patch };
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          type: 'TEMPLATE_UPDATE' as const,
          content: `更新模板「${tpl.name}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'TEMPLATE' as const,
          objectId: id,
          action: '更新模板',
          before,
          after: updated,
          createdAt: now,
        };
        const state = get();
        set({
          templates: state.templates.map((t) => (t.id === id ? updated : t)),
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', '模板已更新');
      },

      saveMedicalAssessment: (taskId, data) => {
        const me = get().currentUser;
        if (!me) return;
        if (me.role !== 'PHYSICIAN' && me.role !== 'PM' && me.role !== 'ADMIN') {
          get().pushToast('error', '权限不足，只有医学人员可以修改医学评估');
          return;
        }
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        if (task.blocked) {
          get().pushToast('error', '任务被阻塞，无法修改医学评估');
          return;
        }
        const before = { ...task };
        const now = new Date().toISOString();
        const updated: Task = { ...task, ...data, updatedAt: now };
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: task.projectId,
          taskId,
          type: 'MEDICAL_ASSESSMENT',
          content: `更新「${task.title}」的医学评估`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'TASK' as const,
          objectId: taskId,
          action: 'medical_assessment_updated',
          before,
          after: updated,
          createdAt: now,
        };
        const state = get();
        set({
          tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', '医学评估已保存');
        get().generateNotifications();
      },

      createFollowUpTask: (originalTaskId) => {
        const me = get().currentUser;
        if (!me) return null;
        if (me.role !== 'PM' && me.role !== 'PROCESSOR' && me.role !== 'ADMIN') {
          get().pushToast('error', '权限不足，无法创建随访任务');
          return null;
        }
        const originalTask = get().tasks.find((t) => t.id === originalTaskId);
        if (!originalTask) {
          get().pushToast('error', '原任务不存在');
          return null;
        }
        const project = get().projects.find((p) => p.id === originalTask.projectId);
        if (!project) {
          get().pushToast('error', '关联项目不存在');
          return null;
        }
        const now = new Date().toISOString();
        const newRound = originalTask.followUpRound + 1;
        const newTask: Task = {
          id: uid('t'),
          projectId: originalTask.projectId,
          title: `[随访-${newRound}] ${originalTask.title.replace(/\[随访-\d+\]\s*/g, '')}`,
          description: originalTask.description,
          type: originalTask.type,
          status: 'NOT_STARTED',
          priority: originalTask.priority,
          assigneeId: originalTask.assigneeId ?? me.id,
          reviewerId: originalTask.reviewerId,
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          caseId: originalTask.caseId,
          riskLevel: originalTask.riskLevel,
          requiredEvidence: [...originalTask.requiredEvidence],
          evidenceUploaded: [],
          product: originalTask.product,
          region: originalTask.region,
          severity: originalTask.severity,
          seriousness: undefined,
          causality: undefined,
          meddraPt: undefined,
          meddraLlt: undefined,
          dayZero: originalTask.dayZero,
          medicalOpinion: '',
          followUpStatus: 'PENDING',
          createdAt: now,
          updatedAt: now,
          regulatoryDeadline: originalTask.regulatoryDeadline,
          dependsOn: [originalTask.id],
          blocked: originalTask.status !== 'DONE',
          signalFlag: false,
          followUpRound: newRound,
          followUpRecords: [],
          customValues: {},
        };
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: originalTask.projectId,
          taskId: newTask.id,
          type: 'FOLLOW_UP',
          content: `创建随访任务「${newTask.title}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'TASK' as const,
          objectId: newTask.id,
          action: 'follow_up_created',
          after: newTask,
          createdAt: now,
        };
        const state = get();
        const allProjectTasks = [newTask, ...state.tasks].filter((t) => t.projectId === originalTask.projectId);
        const completedCount = allProjectTasks.filter((t) => t.status === 'DONE').length;
        const progress = allProjectTasks.length > 0 ? Math.round((completedCount / allProjectTasks.length) * 100) : 0;
        const updatedProjects = state.projects.map((p) =>
          p.id === originalTask.projectId
            ? { ...p, followUpCount: Math.max(p.followUpCount, newRound), progress, updatedAt: now }
            : p,
        );
        const updatedOriginalTask = {
          ...originalTask,
          followUpStatus: 'PENDING' as const,
          updatedAt: now,
        };
        const assigneeId = newTask.assigneeId;
        const followUpNotifications: Notification[] = [];
        if (assigneeId && assigneeId !== me.id) {
          followUpNotifications.push({
            id: uid('n'),
            userId: assigneeId,
            source: newTask.id,
            category: 'SYSTEM',
            content: `【新任务】随访任务「${newTask.title}」已分配给您`,
            status: 'UNREAD',
            createdAt: now,
          });
        }
        set({
          tasks: [newTask, ...state.tasks].map((t) =>
            t.id === originalTaskId ? updatedOriginalTask : t,
          ),
          projects: updatedProjects,
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
          notifications: [...followUpNotifications, ...state.notifications].slice(0, 200),
        });
        get().pushToast('success', `随访任务「${newTask.title}」已创建`);
        get().generateNotifications();
        return newTask;
      },

      saveSubmission: (projectId, submission) => {
        const me = get().currentUser;
        if (!me) return null;
        if (me.role !== 'PM' && me.role !== 'PROCESSOR' && me.role !== 'ADMIN') {
          get().pushToast('error', '权限不足，无法添加提交记录');
          return null;
        }
        const project = get().projects.find((p) => p.id === projectId);
        if (!project) {
          get().pushToast('error', '项目不存在');
          return null;
        }
        const now = new Date().toISOString();
        const state = get();
        let savedSubmission: import('@/types').Submission;
        let actionType: string;
        let activityContent: string;
        const existingIndex = project.submissions.findIndex((s) => s.id === submission.id);
        if (existingIndex >= 0 && submission.id) {
          const existing = project.submissions[existingIndex];
          if (existing.createdBy !== me.id && me.role !== 'PM' && me.role !== 'ADMIN') {
            get().pushToast('error', '权限不足，只能编辑自己创建的提交记录');
            return null;
          }
          savedSubmission = {
            ...existing,
            ...submission,
            id: submission.id!,
            updatedAt: now,
          };
          actionType = 'submission_updated';
          activityContent = `更新监管提交记录「${submission.agency}」`;
        } else {
          savedSubmission = {
            ...submission,
            id: uid('sub'),
            projectId,
            createdBy: me.id,
            createdAt: now,
            updatedAt: now,
          };
          actionType = 'submission_added';
          activityContent = `添加监管提交记录「${submission.agency}」`;
        }
        const updatedSubmissions = existingIndex >= 0 && submission.id
          ? project.submissions.map((s, i) => (i === existingIndex ? savedSubmission : s))
          : [savedSubmission, ...project.submissions];
        const updatedProjects = state.projects.map((p) =>
          p.id === projectId ? { ...p, submissions: updatedSubmissions, updatedAt: now } : p,
        );
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId,
          type: 'SUBMISSION',
          content: activityContent,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'PROJECT' as const,
          objectId: projectId,
          action: actionType,
          after: savedSubmission,
          createdAt: now,
        };
        const returnNotifications: Notification[] = [];
        if (savedSubmission.status === 'RETURNED') {
          if (project.ownerId && project.ownerId !== me.id) {
            returnNotifications.push({
              id: uid('n'),
              userId: project.ownerId,
              source: projectId,
              category: 'SUBMISSION',
              content: `【提交退回】项目「${project.name}」的${savedSubmission.agency}提交被退回`,
              status: 'UNREAD',
              createdAt: now,
            });
          }
        }
        set({
          projects: updatedProjects,
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
          notifications: [...returnNotifications, ...state.notifications].slice(0, 200),
        });
        get().pushToast('success', existingIndex >= 0 ? '提交记录已更新' : '提交记录已添加');
        get().generateNotifications();
        return savedSubmission;
      },

      deleteSubmission: (projectId, submissionId) => {
        const me = get().currentUser;
        if (!me) return;
        const project = get().projects.find((p) => p.id === projectId);
        if (!project) return;
        const submission = project.submissions.find((s) => s.id === submissionId);
        if (!submission) return;
        const isCreator = submission.createdBy === me.id;
        const canDelete = me.role === 'PM' || me.role === 'ADMIN' || isCreator;
        if (!canDelete) {
          get().pushToast('error', '权限不足，无法删除此提交记录');
          return;
        }
        const now = new Date().toISOString();
        const state = get();
        const updatedSubmissions = project.submissions.filter((s) => s.id !== submissionId);
        const updatedProjects = state.projects.map((p) =>
          p.id === projectId ? { ...p, submissions: updatedSubmissions, updatedAt: now } : p,
        );
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId,
          type: 'SUBMISSION',
          content: `删除监管提交记录「${submission.agency}」`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'PROJECT' as const,
          objectId: projectId,
          action: 'submission_deleted',
          before: submission,
          createdAt: now,
        };
        set({
          projects: updatedProjects,
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
        });
        get().pushToast('success', '提交记录已删除');
        get().generateNotifications();
      },

      pushToast: (kind, message) => {
        const id = uid('tst');
        set({ toasts: [...get().toasts, { id, kind, message }] });
        setTimeout(() => {
          set({ toasts: get().toasts.filter((t) => t.id !== id) });
        }, 3200);
      },

      dismissToast: (id) => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
      },

      batchUpdateTasks: (taskIds, action) => {
        const me = get().currentUser;
        if (!me) return;
        if (me.role !== 'PM' && me.role !== 'ADMIN') {
          get().pushToast('error', '权限不足，无法执行批量操作');
          return;
        }
        if (action.type === 'dueDate' && action.deltaDays <= 0) {
          get().pushToast('error', '截止日调整仅允许向后延期');
          return;
        }
        const now = new Date().toISOString();
        const state = get();
        const visibleTasks = selectVisibleTasks(state, me);
        const validTaskIds = new Set(taskIds.filter((id) => visibleTasks.some((t) => t.id === id)));
        if (validTaskIds.size === 0) {
          get().pushToast('error', '没有可操作的任务');
          return;
        }
        let actionLabel = '';
        const updatedTasks = state.tasks.map((t) => {
          if (!validTaskIds.has(t.id)) return t;
          if (action.type === 'assign') {
            actionLabel = '分配负责人';
            return { ...t, assigneeId: action.assigneeId, updatedAt: now };
          }
          if (action.type === 'risk') {
            actionLabel = '调整风险等级';
            if (!['HIGH', 'MEDIUM', 'LOW'].includes(action.riskLevel)) return t;
            return { ...t, riskLevel: action.riskLevel, updatedAt: now };
          }
          if (action.type === 'dueDate') {
            actionLabel = '调整截止日';
            const currentDue = new Date(t.dueAt);
            if (!isNaN(currentDue.getTime())) {
              currentDue.setDate(currentDue.getDate() + action.deltaDays);
              return { ...t, dueAt: currentDue.toISOString(), updatedAt: now };
            }
            return t;
          }
          return t;
        });
        // Bug16: 修复newActivity缺少projectId
        const firstTask = state.tasks.find((t) => validTaskIds.has(t.id));
        const newActivity = {
          id: uid('act'),
          userId: me.id,
          projectId: firstTask?.projectId,
          type: 'BATCH_UPDATE',
          content: `批量${actionLabel}了 ${validTaskIds.size} 个任务`,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'BATCH' as const,
          objectId: 'batch',
          action: `批量${actionLabel}（${validTaskIds.size}个任务）`,
          after: { taskIds: Array.from(validTaskIds), action },
          createdAt: now,
        };
        // 批量操作时为受影响用户生成通知
        const batchNotifications: Notification[] = [];
        const notifiedUsers = new Set<string>();
        if (action.type === 'assign') {
          state.tasks.forEach((t) => {
            if (!validTaskIds.has(t.id)) return;
            const newAssigneeId = action.assigneeId;
            if (newAssigneeId && newAssigneeId !== t.assigneeId && !notifiedUsers.has(newAssigneeId)) {
              batchNotifications.push({
                id: uid('n'),
                userId: newAssigneeId,
                source: 'batch',
                category: 'TASK',
                content: `【批量分配】${me.name} 将多个任务分配给了您`,
                status: 'UNREAD',
                createdAt: now,
              });
              notifiedUsers.add(newAssigneeId);
            }
          });
        } else if (action.type === 'risk' || action.type === 'dueDate') {
          // Bug27/28: 风险/截止日变更通知受影响的任务负责人
          const affectedUserIds = new Set<string>();
          state.tasks.forEach((t) => {
            if (!validTaskIds.has(t.id) || !t.assigneeId) return;
            affectedUserIds.add(t.assigneeId);
          });
          affectedUserIds.forEach((userId) => {
            if (userId !== me.id && !notifiedUsers.has(userId)) {
              batchNotifications.push({
                id: uid('n'),
                userId,
                source: 'batch',
                category: 'TASK',
                content: `【批量更新】${me.name} 批量${actionLabel}了您负责的任务`,
                status: 'UNREAD',
                createdAt: now,
              });
              notifiedUsers.add(userId);
            }
          });
        }
        set({
          tasks: updatedTasks,
          activities: [newActivity, ...state.activities].slice(0, 100),
          auditLogs: [newAuditLog, ...state.auditLogs],
          notifications: [...batchNotifications, ...state.notifications].slice(0, 200),
        });
        get().pushToast('success', `已批量${actionLabel} ${validTaskIds.size} 个任务`);
      },

      saveFilter: (name, conditions) => {
        const me = get().currentUser;
        if (!me) return;
        if (!name || !name.trim()) {
          get().pushToast('error', '筛选名称不能为空');
          return;
        }
        if (get().savedFilters.some((f) => f.name === name.trim())) {
          get().pushToast('error', '已存在同名快捷筛选');
          return;
        }
        const now = new Date().toISOString();
        const filter: SavedFilter = {
          id: uid('filter'),
          name,
          conditions,
          createdBy: me.id,
          createdAt: now,
        };
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'TASK' as const,
          objectId: 'filter',
          action: `保存快捷筛选「${name}」`,
          createdAt: now,
        };
        set({
          savedFilters: [...get().savedFilters, filter],
          auditLogs: [newAuditLog, ...get().auditLogs],
        });
        get().pushToast('success', `快捷筛选「${name}」已保存`);
      },

      deleteFilter: (id) => {
        const me = get().currentUser;
        if (!me) return;
        const filter = get().savedFilters.find((f) => f.id === id);
        if (!filter) return;
        if (filter.createdBy !== me.id && me.role !== 'ADMIN') {
          get().pushToast('error', '权限不足，只能删除自己创建的筛选');
          return;
        }
        const now = new Date().toISOString();
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'TASK' as const,
          objectId: 'filter',
          action: `删除快捷筛选「${filter.name}」`,
          createdAt: now,
        };
        set({
          savedFilters: get().savedFilters.filter((f) => f.id !== id),
          auditLogs: [newAuditLog, ...get().auditLogs],
        });
        get().pushToast('success', `快捷筛选「${filter.name}」已删除`);
      },

      importTasksFromCSV: (rows, mapping) => {
        const me = get().currentUser;
        if (!me) return { totalRows: 0, successCount: 0, skippedCount: 0, failedCount: 0, errors: [], importedAt: new Date().toISOString() };
        if (me.role !== 'PM' && me.role !== 'ADMIN') {
          get().pushToast('error', '权限不足，无法导入任务');
          return { totalRows: 0, successCount: 0, skippedCount: 0, failedCount: 0, errors: [], importedAt: new Date().toISOString() };
        }
        const now = new Date().toISOString();
        const state = get();
        const errors: { row: number; reason: string }[] = [];
        let successCount = 0;
        let skippedCount = 0;
        const newTasks: Task[] = [];
        const IMPORT_LIMIT = 100;
        const rowsToProcess = rows.slice(0, IMPORT_LIMIT);
        rowsToProcess.forEach((row, idx) => {
          const rowNum = idx + 1;
          const title = row[Object.keys(row).find((k) => mapping[k] === 'title') || '']?.trim();
          if (!title) {
            errors.push({ row: rowNum, reason: '缺少必填字段：标题' });
            skippedCount++;
            return;
          }
          // Bug19: title长度限制
          if (title.length > 60) {
            errors.push({ row: rowNum, reason: '标题超过60字符限制' });
            skippedCount++;
            return;
          }
          // PRD 5.3: 重复检测 - 已存在相同标题的任务跳过
          const existingTitle = state.tasks.some((t) => t.title === title) || newTasks.some((t) => t.title === title);
          if (existingTitle) {
            errors.push({ row: rowNum, reason: `已存在相同标题的任务：${title}` });
            skippedCount++;
            return;
          }
          let dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const dueRaw = row[Object.keys(row).find((k) => mapping[k] === 'dueAt') || '']?.trim();
          if (dueRaw) {
            const parsed = new Date(dueRaw.replace(/\//g, '-').replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, ''));
            if (!isNaN(parsed.getTime())) {
              dueAt = parsed.toISOString();
            } else {
              errors.push({ row: rowNum, reason: `截止日格式无法解析：${dueRaw}` });
              skippedCount++;
              return;
            }
          }
          const riskRaw = row[Object.keys(row).find((k) => mapping[k] === 'riskLevel') || '']?.trim();
          const riskLevel: RiskLevel = riskRaw === '高' ? 'HIGH' : riskRaw === '低' ? 'LOW' : 'MEDIUM';
          const projectId = row[Object.keys(row).find((k) => mapping[k] === 'projectId') || '']?.trim();
          const visibleProjects = selectVisibleProjects(state, me);
          const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
          const validProjectId = projectId && visibleProjectIds.has(projectId) ? projectId : visibleProjects[0]?.id;
          if (!validProjectId) {
            errors.push({ row: rowNum, reason: '无法确定所属项目' });
            skippedCount++;
            return;
          }
          const assigneeId = row[Object.keys(row).find((k) => mapping[k] === 'assigneeId') || '']?.trim();
          const validAssigneeId = assigneeId && state.users.some((u) => u.id === assigneeId) ? assigneeId : undefined;
          const description = row[Object.keys(row).find((k) => mapping[k] === 'description') || '']?.trim() || '';
          // Bug36: description长度限制
          if (description.length > 2000) {
            errors.push({ row: rowNum, reason: '描述超过2000字符限制' });
            skippedCount++;
            return;
          }
          const newTask: Task = {
            id: uid('t'),
            projectId: validProjectId,
            title,
            description,
            type: 'CSV导入',
            status: 'NOT_STARTED',
            priority: 'P2',
            assigneeId: validAssigneeId,
            dueAt,
            riskLevel,
            requiredEvidence: [],
            evidenceUploaded: [],
            createdAt: now,
            updatedAt: now,
            dependsOn: [],
            blocked: false,
            signalFlag: false,
            followUpRound: 0,
            followUpRecords: [],
            customValues: {},
          };
          newTasks.push(newTask);
          successCount++;
        });
        if (newTasks.length > 0) {
          // Bug34: newActivity添加projectId
          const firstProjectId = newTasks[0]?.projectId;
          const newActivity = {
            id: uid('act'),
            userId: me.id,
            projectId: firstProjectId,
            type: 'CSV_IMPORT',
            content: `导入了 ${successCount} 个任务`,
            createdAt: now,
          };
          const newAuditLog = {
            id: uid('l'),
            actorId: me.id,
            objectType: 'IMPORT' as const,
            objectId: 'csv-import',
            action: `CSV 导入（成功 ${successCount}，跳过 ${skippedCount}）`,
            createdAt: now,
          };
          // Bug17: 重新计算受影响项目的进度
          const affectedProjectIds = new Set(newTasks.map((t) => t.projectId));
          const allTasksAfterImport = [...newTasks, ...state.tasks];
          const updatedProjects = state.projects.map((p) => {
            if (!affectedProjectIds.has(p.id)) return p;
            const projectTasks = allTasksAfterImport.filter((t) => t.projectId === p.id);
            const completedCount = projectTasks.filter((t) => t.status === 'DONE').length;
            const progress = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;
            return { ...p, progress, updatedAt: now };
          });
          // Bug29: 为被分配人生成通知
          const importNotifications: Notification[] = [];
          const notifiedUserIds = new Set<string>();
          newTasks.forEach((t) => {
            if (t.assigneeId && t.assigneeId !== me.id && !notifiedUserIds.has(t.assigneeId)) {
              importNotifications.push({
                id: uid('n'),
                userId: t.assigneeId,
                source: t.id,
                category: 'TASK',
                content: `【新任务】${me.name} 通过CSV导入将「${t.title}」分配给了您`,
                status: 'UNREAD',
                createdAt: now,
              });
              notifiedUserIds.add(t.assigneeId);
            }
          });
          set({
            tasks: allTasksAfterImport,
            projects: updatedProjects,
            activities: [newActivity, ...state.activities].slice(0, 100),
            auditLogs: [newAuditLog, ...state.auditLogs],
            notifications: [...importNotifications, ...state.notifications].slice(0, 200),
          });
        }
        // Bug35: 根据结果调整提示
        if (successCount === 0) {
          get().pushToast('error', `导入失败：全部 ${skippedCount} 行被跳过`);
        } else {
          get().pushToast('success', `导入完成：成功 ${successCount} 条，跳过 ${skippedCount} 条`);
        }
        return {
          totalRows: rowsToProcess.length,
          successCount,
          skippedCount,
          failedCount: 0,
          errors,
          importedAt: now,
        };
      },

      logCSVExport: (count) => {
        const me = get().currentUser;
        if (!me) return;
        const now = new Date().toISOString();
        const newAuditLog = {
          id: uid('l'),
          actorId: me.id,
          objectType: 'EXPORT' as const,
          objectId: 'csv-export',
          action: `CSV 导出（${count} 条任务）`,
          createdAt: now,
        };
        set({ auditLogs: [newAuditLog, ...get().auditLogs] });
      },

      resetData: () => {
        set({
          currentUser: null,
          users: SEED.users,
          projects: SEED.projects,
          tasks: SEED.tasks,
          comments: SEED.comments,
          attachments: SEED.attachments,
          reviews: SEED.reviews,
          templates: SEED.templates,
          notifications: SEED.notifications,
          auditLogs: SEED.auditLogs,
          aiDrafts: SEED.aiDrafts,
          activities: SEED.activities || [],
          savedFilters: [],
        });
      },
    }),
    {
      name: 'pv-command-center-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentUser: state.currentUser,
        users: state.users,
        projects: state.projects,
        tasks: state.tasks,
        comments: state.comments,
        attachments: state.attachments,
        reviews: state.reviews,
        templates: state.templates,
        notifications: state.notifications,
        auditLogs: state.auditLogs,
        aiDrafts: state.aiDrafts,
        activities: state.activities,
        savedFilters: state.savedFilters,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.activities = state.activities || [];
        state.notifications = state.notifications || [];
        state.auditLogs = state.auditLogs || [];
        state.comments = state.comments || [];
        state.attachments = state.attachments || [];
        state.reviews = state.reviews || [];
        state.aiDrafts = state.aiDrafts || [];
        state.savedFilters = state.savedFilters || [];
        state.tasks = (state.tasks || []).map((t) => ({
          ...t,
          dependsOn: t.dependsOn || [],
          blocked: t.blocked ?? false,
          signalFlag: t.signalFlag ?? false,
          followUpRound: t.followUpRound ?? 0,
          followUpRecords: t.followUpRecords || [],
          customValues: t.customValues || {},
          evidenceUploaded: t.evidenceUploaded || [],
          requiredEvidence: t.requiredEvidence || [],
          reviewerId: t.reviewerId,
          medicalOpinion: t.medicalOpinion ?? '',
          followUpStatus: t.followUpStatus ?? 'NONE',
          regulatoryDeadline: t.regulatoryDeadline,
          seriousness: t.seriousness,
          causality: t.causality,
          meddraPt: t.meddraPt,
          meddraLlt: t.meddraLlt,
          severity: t.severity,
          dayZero: t.dayZero,
        }));
        state.projects = (state.projects || []).map((p) => ({
          ...p,
          followUpCount: p.followUpCount ?? 0,
          submissions: p.submissions || [],
          memberIds: p.memberIds || [],
          progress: p.progress ?? 0,
          dayZero: p.dayZero,
          regulatoryRule: p.regulatoryRule,
          caseType: p.caseType,
          status: p.status || 'ACTIVE',
        }));
      },
    },
  ),
);

// 派生选择器 / 工具
export const selectVisibleProjects = (state: Store, user: User | null, includeClosed = false) => {
  if (!user) return [];
  // Bug16修复: 默认过滤CLOSED项目，ADMIN/QA可见所有
  const baseProjects = includeClosed || user.role === 'ADMIN' || user.role === 'QA'
    ? state.projects
    : state.projects.filter((p) => p.status !== 'CLOSED');
  if (user.role === 'ADMIN' || user.role === 'QA') return baseProjects;
  const userTaskProjectIds = new Set(
    state.tasks
      .filter((t) => t.assigneeId === user.id || t.reviewerId === user.id)
      .map((t) => t.projectId),
  );
  if (user.role === 'VENDOR') {
    return baseProjects.filter(
      (p) => p.memberIds.includes(user.id) || userTaskProjectIds.has(p.id),
    );
  }
  return baseProjects.filter(
    (p) =>
      p.memberIds.includes(user.id) ||
      p.ownerId === user.id ||
      userTaskProjectIds.has(p.id),
  );
};

export const selectVisibleTasks = (state: Store, user: User | null) => {
  const visibleProjects = selectVisibleProjects(state, user);
  const projectIds = new Set(visibleProjects.map((p) => p.id));
  if (!user) return [];
  if (user.role === 'VENDOR') {
    return state.tasks.filter((t) => t.assigneeId === user.id || t.reviewerId === user.id);
  }
  return state.tasks.filter((t) => projectIds.has(t.projectId));
};

export const roleCan = (role: Role, action: 'create_project' | 'edit_template' | 'audit_export' | 'review' | 'upload' | 'view_audit' | 'confirm_ai') => {
  const map: Record<typeof action, Role[]> = {
    create_project: ['PM', 'ADMIN'],
    edit_template: ['PM', 'ADMIN'],
    audit_export: ['QA', 'PM', 'ADMIN'],
    review: ['QA', 'PHYSICIAN', 'PM', 'ADMIN'],
    upload: ['PM', 'PROCESSOR', 'PHYSICIAN', 'QA', 'VENDOR', 'ADMIN'],
    view_audit: ['QA', 'PM', 'ADMIN'],
    confirm_ai: ['PM', 'QA', 'ADMIN'],
  };
  return map[action].includes(role);
};
