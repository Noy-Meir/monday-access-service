import { Request, Response, NextFunction } from 'express';
import { AccessRequestService } from '../service/AccessRequestService';
import { RequestStatus } from '../../../models/AccessRequest';
import { AppError } from '../../../utils/AppError';

export class AccessRequestController {
  constructor(private readonly service: AccessRequestService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.create(req.body, req.user!);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  decide = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.decide(req.params.id, req.body, req.user!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  getByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getByUser(req.params.userId, req.user!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  getByStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.params;
      const validStatuses = Object.values(RequestStatus);

      if (!validStatuses.includes(status as RequestStatus)) {
        throw new AppError(
          `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
          400
        );
      }

      const result = await this.service.getByStatus(status as RequestStatus, req.user!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getAll(req.user!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getById(req.params.id, req.user!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
