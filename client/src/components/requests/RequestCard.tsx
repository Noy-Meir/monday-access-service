import type { AccessRequest } from '../../types';
import { StatusBadge } from './StatusBadge';
import { timeAgo, formatDate } from '../../utils/errorMessages';

interface RequestCardProps {
  request: AccessRequest;
}

export function RequestCard({ request }: RequestCardProps) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{request.applicationName}</p>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{request.justification}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

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
