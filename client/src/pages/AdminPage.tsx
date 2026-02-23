import { useState, useEffect, useCallback } from 'react';
import { requestsService } from '../services/requests.service';
import { useToast } from '../hooks/useToast';
import { extractMessage } from '../utils/errorMessages';
import { RequestsTable } from '../components/admin/RequestsTable';
import { RequestStatus } from '../types';
import type { AccessRequest } from '../types';

type Filter = 'ALL' | RequestStatus;

const filters: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: RequestStatus.PENDING, label: 'Pending' },
  { value: RequestStatus.APPROVED, label: 'Approved' },
  { value: RequestStatus.DENIED, label: 'Denied' },
];

export function AdminPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Filter>('ALL');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data =
        activeFilter === 'ALL'
          ? await requestsService.getAll()
          : await requestsService.getByStatus(activeFilter);
      setRequests(data);
    } catch (err) {
      showToast(extractMessage(err), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, showToast]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleRequestUpdated = (updated: AccessRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  // Counts for filter badges
  const counts = {
    ALL: requests.length,
    [RequestStatus.PENDING]: requests.filter((r) => r.status === RequestStatus.PENDING).length,
    [RequestStatus.APPROVED]: requests.filter((r) => r.status === RequestStatus.APPROVED).length,
    [RequestStatus.DENIED]: requests.filter((r) => r.status === RequestStatus.DENIED).length,
  } as Record<Filter, number>;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Access Requests</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Review and manage all pending access requests
          </p>
        </div>
        <button
          onClick={() => fetchRequests()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
              clipRule="evenodd"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {filters.map((f) => (
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
                  activeFilter === f.value ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500',
                ].join(' ')}
              >
                {counts[f.value] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <RequestsTable
        requests={requests}
        isLoading={isLoading}
        onRequestUpdated={handleRequestUpdated}
      />
    </div>
  );
}
