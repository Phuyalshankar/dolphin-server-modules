import { createDolphinRouter } from '../../dist/router/router.js';
import { createAITask, getAITasks } from '../controllers/aiController.js';

const router = createDolphinRouter();

// AI Task endpoints
router.post('/tasks', createAITask);
router.get('/tasks', getAITasks);

export default router;
