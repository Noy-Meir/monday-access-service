import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { RequestForm } from '../components/requests/RequestForm';
import { RequestList } from '../components/requests/RequestList';
import type { AccessRequest } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  const [newRequest, setNewRequest] = useState<AccessRequest | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleCreated = (request: AccessRequest) => {
    setNewRequest(request);
    setIsFormOpen(false);
    // Reset so future creations also trigger the effect
    setTimeout(() => setNewRequest(null), 0);
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome back, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage your application access requests
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          New Request
        </button>
      </div>

      {/* New request form */}
      {isFormOpen && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Submit Access Request</h2>
          <RequestForm onCreated={handleCreated} />
        </div>
      )}

      {/* Request list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">My Requests</h2>
        <RequestList newRequest={newRequest} />
      </div>
    </div>
  );
}
