import { useState, useEffect, useCallback } from 'react';
import { requestsService } from '../../services/requests.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { extractMessage } from '../../utils/errorMessages';
import { RequestCard } from './RequestCard';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import type { AccessRequest } from '../../types';

interface RequestListProps {
  /** When a new request is submitted from outside, pass it here to prepend to the list. */
  newRequest?: AccessRequest | null;
}

export function RequestList({ newRequest }: RequestListProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await requestsService.getMyRequests(user.id);
      setRequests(data);
    } catch (err) {
      showToast(extractMessage(err), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Prepend newly created request without re-fetching
  useEffect(() => {
    if (newRequest) {
      setRequests((prev) => [newRequest, ...prev]);
    }
  }, [newRequest]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        title="No requests yet"
        description="Submit your first access request using the form above."
      />
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} />
      ))}
    </div>
  );
}
