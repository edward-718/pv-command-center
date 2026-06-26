import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  users: 'users.json',
  projects: 'projects.json',
  tasks: 'tasks.json',
  comments: 'comments.json',
  attachments: 'attachments.json',
  reviews: 'reviews.json',
  auditLogs: 'auditLogs.json',
  notifications: 'notifications.json',
  templates: 'templates.json',
  aiDrafts: 'aiDrafts.json',
};

function loadFile<T>(fileName: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
}

function saveFile(fileName: string, data: unknown): void {
  const filePath = path.join(DATA_DIR, fileName);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

export type StoreData = {
  users: unknown[];
  projects: unknown[];
  tasks: Map<string, unknown>;
  comments: unknown[];
  attachments: unknown[];
  reviews: unknown[];
  auditLogs: unknown[];
  notifications: unknown[];
  templates: unknown[];
  aiDrafts: unknown[];
};

const store: StoreData = {
  users: loadFile(FILES.users, []),
  projects: loadFile(FILES.projects, []),
  tasks: new Map(Object.entries(loadFile(FILES.tasks, {}))),
  comments: loadFile(FILES.comments, []),
  attachments: loadFile(FILES.attachments, []),
  reviews: loadFile(FILES.reviews, []),
  auditLogs: loadFile(FILES.auditLogs, []),
  notifications: loadFile(FILES.notifications, []),
  templates: loadFile(FILES.templates, []),
  aiDrafts: loadFile(FILES.aiDrafts, []),
};

function saveAll(): void {
  saveFile(FILES.users, store.users);
  saveFile(FILES.projects, store.projects);
  saveFile(FILES.tasks, Object.fromEntries(store.tasks));
  saveFile(FILES.comments, store.comments);
  saveFile(FILES.attachments, store.attachments);
  saveFile(FILES.reviews, store.reviews);
  saveFile(FILES.auditLogs, store.auditLogs);
  saveFile(FILES.notifications, store.notifications);
  saveFile(FILES.templates, store.templates);
  saveFile(FILES.aiDrafts, store.aiDrafts);
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveAll, 100);
}

function withSave<T>(fn: () => T): T {
  const result = fn();
  debouncedSave();
  return result;
}

export function getStore(): StoreData {
  return store;
}

export function saveStore(): void {
  debouncedSave();
}

export function updateUsers(data: unknown[]): void {
  store.users = data;
  debouncedSave();
}

export function updateProjects(data: unknown[]): void {
  store.projects = data;
  debouncedSave();
}

export function updateTasks(data: Map<string, unknown>): void {
  store.tasks = data;
  debouncedSave();
}

export function addAuditLog(log: unknown): void {
  store.auditLogs.unshift(log);
  debouncedSave();
}

export const pvStore = {
  ...store,
  save: debouncedSave,
  withSave,
  updateUsers,
  updateProjects,
  updateTasks,
  addAuditLog,
};

export default pvStore;
