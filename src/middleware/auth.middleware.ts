import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    res.status(401).json({ message: 'Missing API key' });
    return;
  }

  // TODO: validate the API key against your auth strategy
  next();
}
