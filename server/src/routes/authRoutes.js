import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import {
  googleAuth,
  googleCallback,
  googleExchange,
} from '../controllers/googleOAuthController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, getMe);

// Google OAuth 2.0 OpenID Connect endpoints
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.post('/google/exchange', googleExchange);

export default router;
