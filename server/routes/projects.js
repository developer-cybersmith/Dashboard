import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/projectController.js';

const router = Router();

router.get   ('/',    requireAuth, ctrl.getAll);
router.post  ('/',    requireAuth, ctrl.create);
router.put   ('/:id', requireAuth, ctrl.update);
router.delete('/:id', requireAuth, ctrl.remove);

export default router;
