'use client';

import { useState, useEffect, useCallback } from 'react';
import { requestsService } from '../../services/requests.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { extractMessage } from '../../utils/errorMessages';
import { RequestCard } from './RequestCard';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { RequestStatus } from '../../types';
import type { AccessRequest } from '../../types';

type Filter = 'ALL' | RequestStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: RequestStatus.PENDING, label: 'Pending' },
  { value: RequestStatus.APPROVED, label: 'Approved' },
  { value: RequestStatus.DENIED, label: 'Denied' },
  { value: 'ALL', label: 'All' },
];

interface RequestListProps {
  /** When a new request is submitted from outside, pass it here to prepend to the list. */
  newRequest?: AccessRequest | null;
}

export function RequestList({ newRequest }: RequestListProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Filter>(RequestStatus.PENDING);

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

  const counts: Record<Filter, number> = {
    ALL: requests.length,
    [RequestStatus.PENDING]: requests.filter((r) => r.status === RequestStatus.PENDING || r.status === RequestStatus.PARTIALLY_APPROVED).length,
    [RequestStatus.PARTIALLY_APPROVED]: requests.filter((r) => r.status === RequestStatus.PARTIALLY_APPROVED).length,
    [RequestStatus.APPROVED]: requests.filter((r) => r.status === RequestStatus.APPROVED).length,
    [RequestStatus.DENIED]: requests.filter((r) => r.status === RequestStatus.DENIED).length,
  };

  const filtered =
    activeFilter === 'ALL' ? requests : requests.filter((r) => r.status === activeFilter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={[
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              activeFilter === f.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {f.label}
            {!isLoading && (
              <span
                className={[
                  'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                  activeFilter === f.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-200 text-gray-500',
                ].join(' ')}
              >
                {counts[f.value] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            activeFilter === 'ALL'
              ? 'No requests yet'
              : `No ${activeFilter.toLowerCase()} requests`
          }
          description={
            activeFilter === RequestStatus.PENDING
              ? 'Submit your first access request using the form above.'
              : `You have no ${activeFilter.toLowerCase()} requests.`
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
