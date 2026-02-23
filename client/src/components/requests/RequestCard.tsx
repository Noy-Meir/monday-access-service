import type { AccessRequest } from '../../types';
import { RequestStatus } from '../../types';
import { StatusBadge } from './StatusBadge';
import { timeAgo, formatDate } from '../../utils/errorMessages';

interface RequestCardProps {
  request: AccessRequest;
}

export function RequestCard({ request }: RequestCardProps) {
  const isPartial = request.status === RequestStatus.PARTIALLY_APPROVED;

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{request.applicationName}</p>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{request.justification}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Approval progress for partially-approved requests */}
      {isPartial && request.requiredApprovals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {request.requiredApprovals.map((role) => {
            const done = request.approvals.some((a) => a.role === role);
            return (
              <span
                key={role}
                className={[
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  done
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
                ].join(' ')}
              >
                {done ? (
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                )}
                {role}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span title={formatDate(request.createdAt)}>
          Submitted {timeAgo(request.createdAt)}
        </span>
        {request.decisionAt && (
          <span title={formatDate(request.decisionAt)}>
            Decided {timeAgo(request.decisionAt)}
          </span>
        )}
        {request.decisionByEmail && (
          <span>by {request.decisionByEmail}</span>
        )}
      </div>

      {request.decisionNote && (
        <div className="mt-3 rounded-md bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600">
          <span className="font-medium">Note: </span>
          {request.decisionNote}
        </div>
      )}
    </div>
  );
}
