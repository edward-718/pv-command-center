import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SEED } from '@/data/seed';
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
  TaskStatus,
  Role,
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
  }) => Project;

  // 通知
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId: string) => void;

  // AI
  saveAIDraft: (projectId: string, kind: AIDraft['kind'], content: string) => void;
  confirmAIDraft: (id: string) => void;

  // 模板
  updateTemplate: (id: string, patch: Partial<Template>) => void;

  // Toast
  pushToast: (kind: ToastEntry['kind'], message: string) => void;
  dismissToast: (id: string) => void;

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
        const before = { ...task };
        const updated: Task = { ...task, status, updatedAt: new Date().toISOString() };
        set({
          tasks: get().tasks.map((t) => (t.id === taskId ? updated : t)),
          auditLogs: [
            {
              id: uid('l'),
              actorId: get().currentUser?.id ?? 'system',
              objectType: 'TASK',
              objectId: taskId,
              action: `更新状态 ${before.status} → ${status}${reason ? `（${reason}）` : ''}`,
              before,
              after: updated,
              createdAt: new Date().toISOString(),
            },
            ...get().auditLogs,
          ],
        });
      },

      updateTaskField: (taskId, field, value) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        const before = { ...task };
        const updated: Task = { ...task, [field]: value, updatedAt: new Date().toISOString() };
        set({
          tasks: get().tasks.map((t) => (t.id === taskId ? updated : t)),
          auditLogs: [
            {
              id: uid('l'),
              actorId: get().currentUser?.id ?? 'system',
              objectType: 'TASK',
              objectId: taskId,
              action: `更新字段 ${String(field)}`,
              before,
              after: updated,
              createdAt: new Date().toISOString(),
            },
            ...get().auditLogs,
          ],
        });
      },

      addComment: (taskId, content, mentions) => {
        const me = get().currentUser;
        if (!me) return;
        const c: Comment = {
          id: uid('c'),
          taskId,
          authorId: me.id,
          content,
          mentions,
          createdAt: new Date().toISOString(),
        };
        set({
          comments: [c, ...get().comments],
          auditLogs: [
            {
              id: uid('l'),
              actorId: me.id,
              objectType: 'TASK',
              objectId: taskId,
              action: '发表评论',
              after: c,
              createdAt: new Date().toISOString(),
            },
            ...get().auditLogs,
          ],
        });
        get().pushToast('success', '评论已发布');
      },

      uploadAttachment: (taskId, fileName, size, type, evidenceKey) => {
        const me = get().currentUser;
        if (!me) return;
        const att: Attachment = {
          id: uid('a'),
          taskId,
          fileName,
          size,
          type,
          version: 1,
          uploaderId: me.id,
          evidenceKey,
          createdAt: new Date().toISOString(),
        };
        const task = get().tasks.find((t) => t.id === taskId);
        set({
          attachments: [att, ...get().attachments],
          tasks: task
            ? get().tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      evidenceUploaded: Array.from(new Set([...t.evidenceUploaded, att.id])),
                      updatedAt: new Date().toISOString(),
                    }
                  : t,
              )
            : get().tasks,
          auditLogs: [
            {
              id: uid('l'),
              actorId: me.id,
              objectType: 'ATTACHMENT',
              objectId: att.id,
              action: `上传附件 ${fileName}`,
              after: att,
              createdAt: new Date().toISOString(),
            },
            ...get().auditLogs,
          ],
        });
        get().pushToast('success', `附件 ${fileName} 上传成功`);
      },

      reviewTask: (taskId, decision, reason) => {
        const me = get().currentUser;
        if (!me) return;
        const review: Review = {
          id: uid('r'),
          taskId,
          reviewerId: me.id,
          decision,
          reason,
          createdAt: new Date().toISOString(),
        };
        const nextStatus: TaskStatus = decision === 'APPROVED' ? 'DONE' : 'NEEDS_INFO';
        const task = get().tasks.find((t) => t.id === taskId);
        set({
          reviews: [review, ...get().reviews],
          tasks: task
            ? get().tasks.map((t) =>
                t.id === taskId ? { ...t, status: nextStatus, updatedAt: new Date().toISOString() } : t,
              )
            : get().tasks,
          auditLogs: [
            {
              id: uid('l'),
              actorId: me.id,
              objectType: 'REVIEW',
              objectId: review.id,
              action: decision === 'APPROVED' ? '复核通过' : `复核退回${reason ? `：${reason}` : ''}`,
              after: review,
              createdAt: new Date().toISOString(),
            },
            ...get().auditLogs,
          ],
        });
        get().pushToast(
          decision === 'APPROVED' ? 'success' : 'info',
          decision === 'APPROVED' ? '已通过复核' : '已退回补充',
        );
      },

      createTaskFromTemplate: (projectId, _templateId) => {
        // MVP: 不再生成任务，保留扩展位
        return;
      },

      createProjectFromTemplate: (input) => {
        const me = get().currentUser;
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
          ownerId: me?.id ?? 'u-001',
          status: 'ACTIVE',
          startDate: now,
          templateId: input.templateId,
          memberIds: me ? [me.id] : ['u-001'],
          progress: 0,
        };
        // 按模板生成任务
        const tpl = get().templates.find((t) => t.id === input.templateId);
        const startMs = Date.now();
        const newTasks: Task[] = (tpl?.nodes ?? []).map((n, i) => ({
          id: uid('t'),
          projectId: id,
          title: n.title,
          description: n.description ?? '',
          type: n.type,
          status: 'NOT_STARTED' as TaskStatus,
          priority: i === 0 ? 'P0' : i < 2 ? 'P1' : 'P2',
          assigneeId: undefined,
          reviewerId: me?.role === 'PM' ? me.id : 'u-001',
          dueAt: new Date(startMs + n.relativeDueDays * 24 * 60 * 60 * 1000).toISOString(),
          riskLevel: 'MEDIUM' as const,
          requiredEvidence: n.requiredEvidence,
          evidenceUploaded: [],
          product: input.product,
          region: input.region,
          createdAt: now,
          updatedAt: now,
        }));
        set({
          projects: [project, ...get().projects],
          tasks: [...newTasks, ...get().tasks],
          auditLogs: [
            {
              id: uid('l'),
              actorId: me?.id ?? 'system',
              objectType: 'PROJECT',
              objectId: id,
              action: `从模板 ${tpl?.name ?? input.templateId} 创建项目 ${input.name}`,
              after: project,
              createdAt: now,
            },
            ...get().auditLogs,
          ],
        });
        get().pushToast('success', `项目「${input.name}」已创建，${newTasks.length} 个任务已生成`);
        return project;
      },

      markNotificationRead: (id) => {
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, status: 'READ' } : n,
          ),
        });
      },

      markAllNotificationsRead: (userId) => {
        set({
          notifications: get().notifications.map((n) =>
            n.userId === userId ? { ...n, status: 'READ' } : n,
          ),
        });
      },

      saveAIDraft: (projectId, kind, content) => {
        const me = get().currentUser;
        const draft: AIDraft = {
          id: uid('aig'),
          projectId,
          kind,
          content,
          createdAt: new Date().toISOString(),
          confirmed: false,
          authorId: me?.id ?? 'u-001',
        };
        set({ aiDrafts: [draft, ...get().aiDrafts] });
        get().pushToast('success', 'AI 草稿已保存');
      },

      confirmAIDraft: (id) => {
        set({
          aiDrafts: get().aiDrafts.map((d) => (d.id === id ? { ...d, confirmed: true } : d)),
        });
        get().pushToast('success', 'AI 草稿已确认为正式记录');
      },

      updateTemplate: (id, patch) => {
        set({
          templates: get().templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        });
        get().pushToast('success', '模板已更新');
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
      }),
    },
  ),
);

// 派生选择器 / 工具
export const selectVisibleProjects = (state: Store, user: User | null) => {
  if (!user) return [];
  if (user.role === 'ADMIN' || user.role === 'QA') return state.projects;
  if (user.role === 'VENDOR') {
    return state.projects.filter(
      (p) => p.memberIds.includes(user.id) || state.tasks.some((t) => t.projectId === p.id && t.assigneeId === user.id),
    );
  }
  return state.projects.filter((p) => p.memberIds.includes(user.id) || p.ownerId === user.id);
};

export const selectVisibleTasks = (state: Store, user: User | null) => {
  const visibleProjects = selectVisibleProjects(state, user);
  const projectIds = new Set(visibleProjects.map((p) => p.id));
  if (!user) return [];
  if (user.role === 'VENDOR') {
    return state.tasks.filter((t) => t.assigneeId === user.id);
  }
  return state.tasks.filter((t) => projectIds.has(t.projectId));
};

export const roleCan = (role: Role, action: 'create_project' | 'edit_template' | 'audit_export' | 'review' | 'upload' | 'view_audit' | 'confirm_ai') => {
  const map: Record<typeof action, Role[]> = {
    create_project: ['PM', 'ADMIN'],
    edit_template: ['PM', 'ADMIN'],
    audit_export: ['QA', 'PM', 'ADMIN'],
    review: ['QA', 'PHYSICIAN', 'PM'],
    upload: ['PM', 'PROCESSOR', 'PHYSICIAN', 'QA', 'VENDOR', 'ADMIN'],
    view_audit: ['QA', 'PM', 'ADMIN'],
    confirm_ai: ['PM', 'QA', 'ADMIN'],
  };
  return map[action].includes(role);
};
