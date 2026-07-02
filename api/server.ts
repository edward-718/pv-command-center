/**
 * local server entry file, for local development
 */
import app, { startServer } from './app.js';
import { checkTaskDeadlines, checkEvidenceCompleteness } from './services/notification.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3010;

const server = startServer(app, PORT);

/**
 * 定时任务：检查任务截止日期和证据完整性
 */
function runNotificationChecks(): void {
  const time = new Date().toISOString();
  console.log(`[${time}] [NOTIFICATION] Running notification checks...`);
  try {
    checkTaskDeadlines();
    console.log(`[${time}] [NOTIFICATION] Task deadline check completed`);
  } catch (err) {
    console.error(`[${time}] [NOTIFICATION] Task deadline check failed:`, err);
  }
  try {
    checkEvidenceCompleteness();
    console.log(`[${time}] [NOTIFICATION] Evidence completeness check completed`);
  } catch (err) {
    console.error(`[${time}] [NOTIFICATION] Evidence completeness check failed:`, err);
  }
}

// 服务器启动时先执行一次
console.log(`[SERVER] Initial notification check on startup...`);
runNotificationChecks();

// 每 5 分钟执行一次
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const notificationTimer = setInterval(runNotificationChecks, CHECK_INTERVAL);

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  clearInterval(notificationTimer);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  clearInterval(notificationTimer);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;