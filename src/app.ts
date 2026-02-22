import express from 'express';
import router from './routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', router);

app.use(errorMiddleware);

export default app;
