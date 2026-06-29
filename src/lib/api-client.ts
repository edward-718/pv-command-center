/**
 * API 客户端配置
 * 统一管理后端 API 地址和请求配置
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const token = localStorage.getItem('pv-token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export const api = new ApiClient(API_BASE);

// 认证
export const authApi = {
  login: (email: string) => api.post<{ token: string; user: unknown }>('/auth/login', { email }),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get<unknown>('/auth/me'),
  users: () => api.get<unknown[]>('/auth/users'),
};

// 项目
export const projectsApi = {
  list: () => api.get<unknown[]>('/projects'),
  get: (id: string) => api.get<unknown>(`/projects/${id}`),
  create: (data: unknown) => api.post<unknown>('/projects', data),
  tasks: (id: string) => api.get<unknown[]>(`/projects/${id}/tasks`),
};

// 任务
export const tasksApi = {
  list: (params?: { projectId?: string; assigneeId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.projectId) searchParams.set('projectId', params.projectId);
    if (params?.assigneeId) searchParams.set('assigneeId', params.assigneeId);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return api.get<unknown[]>(`/tasks${query}`);
  },
  get: (id: string) => api.get<unknown>(`/tasks/${id}`),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch<unknown>(`/tasks/${id}/status`, { status, reason }),
  addComment: (id: string, content: string, mentions: string[] = []) =>
    api.post<unknown>(`/tasks/${id}/comments`, { content, mentions }),
  uploadAttachment: (id: string, data: unknown) =>
    api.post<unknown>(`/tasks/${id}/attachments`, data),
  review: (id: string, decision: 'APPROVED' | 'RETURNED', reason?: string) =>
    api.post<unknown>(`/tasks/${id}/review`, { decision, reason }),
};

// 审计
export const auditApi = {
  logs: (params?: { objectType?: string; actorId?: string; q?: string; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.objectType) searchParams.set('objectType', params.objectType);
    if (params?.actorId) searchParams.set('actorId', params.actorId);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return api.get<PaginatedResponse>(`/audit/logs${query}`);
  },
  export: (projectId: string) => api.post<unknown>('/audit/export', { projectId }),
};

// AI 草稿
export const aiApi = {
  drafts: (params?: { projectId?: string; authorId?: string; confirmed?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.projectId) searchParams.set('projectId', params.projectId);
    if (params?.authorId) searchParams.set('authorId', params.authorId);
    if (params?.confirmed !== undefined) searchParams.set('confirmed', String(params.confirmed));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return api.get<unknown[]>(`/ai/drafts${query}`);
  },
  generate: (projectId: string, kind: string) => api.post<unknown>('/ai/draft', { projectId, kind }),
  confirm: (id: string) => api.put<unknown>(`/ai/draft/${id}/confirm`),
};

// 通知
export const notificationsApi = {
  list: (params?: { unread?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.unread !== undefined) searchParams.set('unread', String(params.unread));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return api.get<unknown[]>(`/notifications${query}`);
  },
  markRead: (id: string) => api.put<unknown>(`/notifications/${id}/read`),
  markAllRead: () => api.put<unknown>('/notifications/read-all'),
};

// 模板
export const templatesApi = {
  list: () => api.get<unknown[]>('/templates'),
  get: (id: string) => api.get<unknown>(`/templates/${id}`),
  update: (id: string, data: unknown) => api.put<unknown>(`/templates/${id}`, data),
};

// 用户
export const usersApi = {
  list: () => api.get<unknown[]>('/users'),
  get: (id: string) => api.get<unknown>(`/users/${id}`),
};

export default api;
