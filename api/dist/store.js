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
function saveFile(fileName, data) {
    const filePath = path.join(DATA_DIR, fileName);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
}
const store = {
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
    saveTimeout = setTimeout(saveAll, 100);
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
    withSave,
    updateUsers,
    updateProjects,
    updateTasks,
    addAuditLog,
};
export default pvStore;
