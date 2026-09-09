import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/documentController.js';

const router = Router();

router.use(requireAuth);

// Specific paths first (before /:kind)
router.get('/file/:fileId', ctrl.download);
router.delete('/file/:fileId', ctrl.remove);
router.patch('/billing/:projectId', ctrl.patchProjectBilling);

// List / upload for a project
router.get('/:kind/project/:projectId', ctrl.listByProject);
router.post(
  '/:kind/project/:projectId',
  (req, res, next) => {
    ctrl.uploadPdf.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  ctrl.upload,
);

// List all docs of a kind (invoice | po)
router.get('/:kind', ctrl.listAll);

export default router;
