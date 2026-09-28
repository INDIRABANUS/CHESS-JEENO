import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import apiRouter from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSocketServer } from './realtime/socket.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Configure CORS
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

// Initialize Socket.IO server
initSocketServer(httpServer);

// Start server
const startServer = async () => {
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Health check available at http://localhost:${PORT}/api/health`);
    console.log(`⚡ Socket.IO realtime server initialized`);
  });
};

startServer();

export { app, httpServer };
export default app;
