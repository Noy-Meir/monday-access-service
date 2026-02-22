import { Router } from 'express';
import { getBoards } from '../controllers/monday.controller';

const router = Router();

router.get('/boards', getBoards);

export default router;
