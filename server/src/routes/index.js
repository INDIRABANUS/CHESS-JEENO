import express from 'express';
import healthRoutes from './healthRoutes.js';
import tournamentRoutes from './tournamentRoutes.js';
import { resolveCreatorId } from '../utils/devUser.js';
import User from '../models/User.js';

const apiRouter = express.Router();

apiRouter.use('/', healthRoutes);
apiRouter.use('/tournaments', tournamentRoutes);

// Endpoint for retrieving current development user profile
apiRouter.get('/dev-user', async (req, res, next) => {
  try {
    const userId = await resolveCreatorId(req);
    const user = await User.findById(userId).select('name email avatar lichessUsername');
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

export default apiRouter;
