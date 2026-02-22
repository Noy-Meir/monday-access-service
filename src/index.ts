import app from './app';
import { config } from './config';

app.listen(config.port, () => {
  console.log(`monday-access-service running on port ${config.port}`);
});
