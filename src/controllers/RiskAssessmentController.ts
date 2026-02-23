import { Request, Response, NextFunction } from 'express';
import { AccessRequestService } from '../services/AccessRequestService';
import { IRiskAssessmentAgent } from '../ai/agent/IRiskAssessmentAgent';

export class RiskAssessmentController {
  constructor(
    private readonly accessRequestService: AccessRequestService,
    private readonly agent: IRiskAssessmentAgent,
  ) {}

  assess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = await this.accessRequestService.getById(req.params.id, req.user!);
      const result = await this.agent.assess(request);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
