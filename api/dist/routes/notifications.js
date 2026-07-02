/**
 * 通知 API
 * - GET  /api/notifications              通知列表（支持分页、status/unread筛选）
 * - GET  /api/notifications/count        各类通知计数
 * - PUT  /api/notifications/:id/read     标记单条已读
 * - PUT  /api/notifications/read-all     标记全部已读
 */
import { Router } from 'express';
import pvStore from '../store.js';
import { authenticate } from '../middleware/auth.js';
import { success, error } from '../errors.js';
import { getNotificationCounts } from '../services/notification.js';
const router = Router();
// 通知列表
router.get('/', authenticate, (req, res) => {
    const user = req.user;
    const { status, unread, page = '1', pageSize = '20' } = req.query;
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    if (isNaN(p) || p < 1) {
        return res.status(400).json(error(400, 'page must be >= 1'));
    }
    if (isNaN(ps) || ps < 1 || ps > 100) {
        return res.status(400).json(error(400, 'pageSize must be between 1 and 100'));
    }
    let list = [...pvStore.notifications].filter((n) => n.userId === user.id);
    if (unread !== undefined) {
        const isUnread = unread === 'true' || unread === '1';
        list = list.filter((n) => (isUnread ? n.status === 'UNREAD' : n.status === 'READ'));
    }
    else if (status) {
        list = list.filter((n) => n.status === status);
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = list.length;
    const start = (p - 1) * ps;
    res.json(success({
        items: list.slice(start, start + ps),
        total,
        page: p,
        pageSize: ps,
        totalPages: Math.ceil(total / ps),
    }));
});
// 各类通知计数
router.get('/count', authenticate, (req, res) => {
    const user = req.user;
    const counts = getNotificationCounts(user.id);
    res.json(success(counts));
});
// 标记单条通知已读
router.put('/:id/read', authenticate, (req, res) => {
    const user = req.user;
    const notification = pvStore.notifications.find((n) => n.id === req.params.id && n.userId === user.id);
    if (!notification)
        return res.status(404).json(error(404, 'notification not found'));
    notification.status = 'READ';
    pvStore.save();
    res.json(success(notification));
});
// 标记全部通知已读
router.put('/read-all', authenticate, (req, res) => {
    const user = req.user;
    let count = 0;
    pvStore.notifications.forEach((n) => {
        if (n.userId === user.id && n.status === 'UNREAD') {
            n.status = 'READ';
            count++;
        }
    });
    pvStore.save();
    res.json(success({ count }, 'all notifications marked as read'));
});
export default router;
