import { TokenPayload } from '../models/AccessRequest';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}
