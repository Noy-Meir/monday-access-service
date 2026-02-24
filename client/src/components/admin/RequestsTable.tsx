'use client';

import { useState } from 'react';
import { requestsService } from '../../services/requests.service';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { extractMessage, timeAgo } from '../../utils/errorMessages';
import { StatusBadge } from '../requests/StatusBadge';
import { RiskBadge, RiskPanel } from './RiskBadge';
import { DecisionModal } from './DecisionModal';
import { Button } from '../ui/Button';
import { TableRowSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { RequestStatus, Role } from '../../types';
import type { AccessRequest, RiskAssessmentResult } from '../../types';

interface RequestsTableProps {
  requests: AccessRequest[];
  isLoading: boolean;
  onRequestUpdated: (updated: AccessRequest) => void;
}

type Decision = RequestStatus.APPROVED | RequestStatus.DENIED;

function ApprovalProgress({ request }: { request: AccessRequest }) {
  if (!request.requiredApprovals.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {request.requiredApprovals.map((role) => {
        const done = request.approvals.some((a) => a.role === role);
        return (
          <span
            key={role}
            className={[
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              done
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
            ].join(' ')}
          >
            {done ? '✓' : '⏳'} {role}
          </span>
        );
      })}
    </div>
  );
}

export function RequestsTable({ requests, isLoading, onRequestUpdated }: RequestsTableProps) {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Decision modal state
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  // Risk assessment state: requestId → result | 'loading' | 'error'
  const [riskMap, setRiskMap] = useState<
    Record<string, RiskAssessmentResult | 'loading' | 'error'>
  >({});

  const openDecisionModal = (request: AccessRequest, decision: Decision) => {
    setSelectedRequest(request);
    setSelectedDecision(decision);
  };

  const handleRunRisk = async (request: AccessRequest) => {
    setRiskMap((prev) => ({ ...prev, [request.id]: 'loading' }));
    try {
      const result = await requestsService.getRiskAssessment(request.id);
      setRiskMap((prev) => ({ ...prev, [request.id]: result }));
    } catch (err) {
      setRiskMap((prev) => ({ ...prev, [request.id]: 'error' }));
      showToast(extractMessage(err), 'error');
    }
  };

  const handleDecided = (updated: AccessRequest) => {
    onRequestUpdated(updated);
  };

  /** Returns true if the current user can approve the given request. */
  function canApproveRequest(req: AccessRequest): boolean {
    if (!user) return false;
    if (user.role === Role.ADMIN) return true;
    if (!req.requiredApprovals.includes(user.role)) return false;
    // Hide the Approve button if this role has already approved
    return !req.approvals.some((a) => a.role === user.role);
  }

  /** Returns true if the current user can deny the given request. */
  function canDenyRequest(req: AccessRequest): boolean {
    if (!user) return false;
    if (user.role === Role.ADMIN) return true;
    return req.requiredApprovals.includes(user.role);
  }

  const isActionable = (req: AccessRequest) =>
    req.status === RequestStatus.PENDING || req.status === RequestStatus.PARTIALLY_APPROVED;

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Requester', 'Application', 'Justification', 'Submitted', 'Status', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {[1, 2, 3].map((i) => (
              <TableRowSkeleton key={i} cols={6} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <EmptyState title="No requests found" description="There are no requests matching the current filter." />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Requester', 'Application', 'Justification', 'Submitted', 'Status', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {requests.map((req) => {
              const risk = riskMap[req.id];
              const actionable = isActionable(req);

              return (
                <>
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    {/* Requester */}
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      <div className="font-medium">{req.createdByEmail.split('@')[0]}</div>
                      <div className="text-xs text-gray-400">{req.createdByEmail}</div>
                    </td>

                    {/* Application */}
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap max-w-[160px] truncate">
                      {req.applicationName}
                    </td>

                    {/* Justification */}
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px]">
                      <span className="line-clamp-2">{req.justification}</span>
                    </td>

                    {/* Submitted */}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {timeAgo(req.createdAt)}
                    </td>

                    {/* Status + approval progress */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={req.status} />
                      {(req.status === RequestStatus.PARTIALLY_APPROVED ||
                        (actionable && req.requiredApprovals.length > 1)) && (
                        <ApprovalProgress request={req} />
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Risk assessment */}
                        {risk === undefined && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRunRisk(req)}
                          >
                            <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Risk
                          </Button>
                        )}

                        {risk === 'loading' && (
                          <span className="text-xs text-gray-400 animate-pulse">Assessing…</span>
                        )}

                        {risk === 'error' && (
                          <span className="text-xs text-red-400">AI unavailable</span>
                        )}

                        {risk && risk !== 'loading' && risk !== 'error' && (
                          <RiskBadge riskLevel={risk.riskLevel} score={risk.score} />
                        )}

                        {/* Decision buttons — only for actionable requests where role is authorized */}
                        {actionable && canApproveRequest(req) && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => openDecisionModal(req, RequestStatus.APPROVED)}
                          >
                            Approve
                          </Button>
                        )}
                        {actionable && canDenyRequest(req) && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openDecisionModal(req, RequestStatus.DENIED)}
                          >
                            Deny
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline risk panel row */}
                  {risk && risk !== 'loading' && risk !== 'error' && (
                    <tr key={`${req.id}-risk`} className="bg-gray-50/50">
                      <td colSpan={6} className="px-4 py-3">
                        <RiskPanel
                          riskLevel={risk.riskLevel}
                          score={risk.score}
                          reasoning={risk.reasoning}
                          provider={risk.metrics.provider}
                          executionTimeMs={risk.metrics.executionTimeMs}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <DecisionModal
        request={selectedRequest}
        decision={selectedDecision}
        onClose={() => {
          setSelectedRequest(null);
          setSelectedDecision(null);
        }}
        onDecided={handleDecided}
      />
    </>
  );
}
