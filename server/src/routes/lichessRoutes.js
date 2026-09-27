import express from 'express';
import {
  connect,
  callback,
  getStatus,
  disconnect,
} from '../controllers/lichessOAuthController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/connect', requireAuth, connect);
router.get('/callback', callback);
router.get('/status', requireAuth, getStatus);
router.post('/disconnect', requireAuth, disconnect);

export default router;
