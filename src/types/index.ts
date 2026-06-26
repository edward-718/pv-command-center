// 共享类型定义 - 与后端 API 保持一致

export type Role = 'PM' | 'PROCESSOR' | 'PHYSICIAN' | 'QA' | 'VENDOR' | 'ADMIN';

export const ROLE_LABEL: Record<Role, string> = {
  PM: 'PV 项目经理',
  PROCESSOR: 'Case Processor',
  PHYSICIAN: 'Safety Physician',
  QA: 'QA / 质量',
  VENDOR: 'CRO 供应商',
  ADMIN: '系统管理员',
};

export const ROLE_TONE: Record<Role, string> = {
  PM: 'bg-teal-50 text-teal-700 border-teal-200',
  PROCESSOR: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
  PHYSICIAN: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  QA: 'bg-cobalt-50 text-cobalt-600 border-cobalt-200',
  VENDOR: 'bg-ink-100 text-ink-700 border-ink-200',
  ADMIN: 'bg-ink-900 text-white border-ink-900',
};

export type ProjectType = 'ICSR' | 'INQUIRY' | 'CAPA' | 'PSUR';
export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  ICSR: '个例安全报告',
  INQUIRY: '监管问询',
  CAPA: 'CAPA 整改',
  PSUR: '定期安全更新',
};

export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'DONE';
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '处理中',
  IN_REVIEW: '待复核',
  NEEDS_INFO: '需补充',
  DONE: '已完成',
};
export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-ink-100 text-ink-600 border-ink-200',
  IN_PROGRESS: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
  IN_REVIEW: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  NEEDS_INFO: 'bg-danger-500/10 text-danger-600 border-danger-500/30',
  DONE: 'bg-teal-50 text-teal-700 border-teal-200',
};

export type Priority = 'P0' | 'P1' | 'P2';
export const PRIORITY_LABEL: Record<Priority, string> = {
  P0: 'P0 · 紧急',
  P1: 'P1 · 高',
  P2: 'P2 · 常规',
};
export const PRIORITY_TONE: Record<Priority, string> = {
  P0: 'bg-danger-500/10 text-danger-700 border-danger-500/30',
  P1: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  P2: 'bg-ink-100 text-ink-700 border-ink-200',
};

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
};
export const RISK_TONE: Record<RiskLevel, string> = {
  LOW: 'bg-teal-50 text-teal-700 border-teal-200',
  MEDIUM: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  HIGH: 'bg-danger-500/10 text-danger-600 border-danger-500/30',
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  org: string;
  avatar?: string;
};

export type Project = {
  id: string;
  name: string;
  code: string;
  type: ProjectType;
  product: string;
  region: string;
  ownerId: string;
  status: 'ACTIVE' | 'CLOSED';
  startDate: string;
  endDate?: string;
  templateId: string;
  memberIds: string[];
  progress: number; // 0-100
  description: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: string;
  reviewerId?: string;
  dueAt: string; // ISO
  caseId?: string;
  riskLevel: RiskLevel;
  requiredEvidence: string[];
  evidenceUploaded: string[]; // 已上传的证据 ID
  product?: string;
  region?: string;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  seriousness?: 'SERIOUS' | 'NON_SERIOUS';
  dayZero?: string;
  medicalOpinion?: string;
  followUpStatus?: 'NONE' | 'PENDING' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  mentions: string[];
  createdAt: string;
};

export type Attachment = {
  id: string;
  taskId: string;
  fileName: string;
  size: number;
  type: string;
  version: number;
  uploaderId: string;
  createdAt: string;
  evidenceKey?: string; // 对应的必填证据 key
};

export type AuditLog = {
  id: string;
  actorId: string;
  objectType: 'TASK' | 'PROJECT' | 'TEMPLATE' | 'ATTACHMENT' | 'REVIEW' | 'EXPORT';
  objectId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

export type Review = {
  id: string;
  taskId: string;
  reviewerId: string;
  decision: 'APPROVED' | 'RETURNED';
  reason?: string;
  createdAt: string;
};

export type TemplateNode = {
  id: string;
  title: string;
  type: string;
  defaultRole: Role;
  relativeDueDays: number;
  requiredEvidence: string[];
  description?: string;
};

export type Template = {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  nodes: TemplateNode[];
  reminderThresholds: number[]; // 距离截止 N 天时提醒
};

export type Notification = {
  id: string;
  userId: string;
  source: string; // e.g. taskId
  category: 'DEADLINE' | 'OVERDUE' | 'REVIEW' | 'EVIDENCE' | 'SYSTEM';
  content: string;
  status: 'UNREAD' | 'READ';
  createdAt: string;
};

export type AIDraft = {
  id: string;
  projectId: string;
  kind: 'WEEKLY' | 'MEETING' | 'CAPA' | 'RISK';
  content: string;
  createdAt: string;
  confirmed: boolean;
  authorId: string;
};

export type DashboardKPI = {
  totalTasks: number;
  overdueTasks: number;
  inReviewTasks: number;
  dueSoonTasks: number;
  doneTasks: number;
  activeProjects: number;
  highRiskTasks: number;
  missingEvidence: number;
};

export type AuthState = {
  currentUser: User | null;
  isAuthenticated: boolean;
};
