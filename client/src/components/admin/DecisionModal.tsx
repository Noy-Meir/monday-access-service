import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { requestsService } from '../../services/requests.service';
import { useToast } from '../../hooks/useToast';
import { extractMessage } from '../../utils/errorMessages';
import { RequestStatus } from '../../types';
import type { AccessRequest } from '../../types';

type Decision = RequestStatus.APPROVED | RequestStatus.DENIED;

interface DecisionModalProps {
  request: AccessRequest | null;
  decision: Decision | null;
  onClose: () => void;
  onDecided: (updated: AccessRequest) => void;
}

const decisionConfig: Record<Decision, { title: string; confirmLabel: string; variant: 'primary' | 'danger'; successMsg: string }> = {
  [RequestStatus.APPROVED]: {
    title: 'Approve Request',
    confirmLabel: 'Confirm Approval',
    variant: 'primary',
    successMsg: 'Request approved successfully.',
  },
  [RequestStatus.DENIED]: {
    title: 'Deny Request',
    confirmLabel: 'Confirm Denial',
    variant: 'danger',
    successMsg: 'Request denied successfully.',
  },
};

export function DecisionModal({ request, decision, onClose, onDecided }: DecisionModalProps) {
  const { showToast } = useToast();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = request !== null && decision !== null;
  const cfg = decision ? decisionConfig[decision] : null;

  const handleConfirm = async () => {
    if (!request || !decision || !cfg) return;
    setIsSubmitting(true);
    try {
      const updated = await requestsService.decide(request.id, {
        decision,
        decisionNote: note.trim() || undefined,
      });
      onDecided(updated);
      showToast(cfg.successMsg, 'success');
      setNote('');
      onClose();
    } catch (err) {
      showToast(extractMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setNote('');
    onClose();
  };

  // @ts-ignore
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={cfg?.title ?? ''}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={cfg?.variant ?? 'primary'}
            onClick={handleConfirm}
            isLoading={isSubmitting}
          >
            {cfg?.confirmLabel}
          </Button>
        </>
      }
    >
      {request && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-gray-900">{request.applicationName}</p>
            <p className="text-xs text-gray-500 line-clamp-3">{request.justification}</p>
            <p className="text-xs text-gray-400">Requested by {request.createdByEmail}</p>
          </div>
          <Textarea
            label="Decision Note (optional)"
            placeholder="Add a note for the requester..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={isSubmitting}
          />
        </div>
      )}
    </Modal>
  );
}
