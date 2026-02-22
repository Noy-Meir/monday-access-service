import { Request, Response, NextFunction } from 'express';
import { mondayService } from '../services/monday.service';

export async function getBoards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await mondayService.query(`
      query {
        boards {
          id
          name
        }
      }
    `);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
