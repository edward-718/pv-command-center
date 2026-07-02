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
function loadFile(fileName, defaultValue) {
    const filePath = path.join(DATA_DIR, fileName);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        return defaultValue;
    }
}
function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}
function ensureMap(value) {
    if (value instanceof Map)
        return value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return new Map(Object.entries(value));
    }
    return new Map();
}
function saveFile(fileName, data) {
    const filePath = path.join(DATA_DIR, fileName);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
}
const store = {
    users: ensureArray(loadFile(FILES.users, [])),
    projects: ensureArray(loadFile(FILES.projects, [])),
    tasks: ensureMap(loadFile(FILES.tasks, {})),
    comments: ensureArray(loadFile(FILES.comments, [])),
    attachments: ensureArray(loadFile(FILES.attachments, [])),
    reviews: ensureArray(loadFile(FILES.reviews, [])),
    auditLogs: ensureArray(loadFile(FILES.auditLogs, [])),
    notifications: ensureArray(loadFile(FILES.notifications, [])),
    templates: ensureArray(loadFile(FILES.templates, [])),
    aiDrafts: ensureArray(loadFile(FILES.aiDrafts, [])),
};
function saveAll() {
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
let saveTimeout = null;
function debouncedSave() {
    if (saveTimeout)
        clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveAll, 200);
}
function saveImmediate() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    saveAll();
}
function withSave(fn) {
    const result = fn();
    debouncedSave();
    return result;
}
export function getStore() {
    return store;
}
export function saveStore() {
    debouncedSave();
}
export function saveStoreImmediate() {
    saveImmediate();
}
export function updateUsers(data) {
    store.users = data;
    debouncedSave();
}
export function updateProjects(data) {
    store.projects = data;
    debouncedSave();
}
export function updateTasks(data) {
    store.tasks = data;
    debouncedSave();
}
export function addAuditLog(log) {
    store.auditLogs.unshift(log);
    debouncedSave();
}
export const pvStore = {
    ...store,
    save: debouncedSave,
    saveImmediate,
    withSave,
    updateUsers,
    updateProjects,
    updateTasks,
    addAuditLog,
};
export default pvStore;
