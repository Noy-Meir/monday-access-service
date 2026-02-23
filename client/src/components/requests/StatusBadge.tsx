import { RequestStatus } from '../../types';

const config: Record<RequestStatus, { label: string; classes: string }> = {
  [RequestStatus.PENDING]: {
    label: 'Pending',
    classes: 'bg-amber-100 text-amber-700 ring-amber-200',
  },
  [RequestStatus.PARTIALLY_APPROVED]: {
    label: 'Partially Approved',
    classes: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  },
  [RequestStatus.APPROVED]: {
    label: 'Approved',
    classes: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  },
  [RequestStatus.DENIED]: {
    label: 'Denied',
    classes: 'bg-red-100 text-red-700 ring-red-200',
  },
};

interface StatusBadgeProps {
  status: RequestStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, classes } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
