/**
 * local server entry file, for local development
 */
import app, { startServer } from './app.js';
/**
 * start server with port
 */
const PORT = process.env.PORT || 3010;
const server = startServer(app, PORT);
/**
 * close server
 */
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
export default app;
