import { useState, type FormEvent } from 'react';
import { requestsService } from '../../services/requests.service';
import { useToast } from '../../hooks/useToast';
import { extractMessage } from '../../utils/errorMessages';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import type { AccessRequest } from '../../types';

interface RequestFormProps {
  onCreated: (request: AccessRequest) => void;
}

interface FormErrors {
  applicationName?: string;
  justification?: string;
}

const CATALOG_APPS = [
  'AWS Console',
  'GitHub',
  'Jira',
  'Confluence',
  'VPN Access',
  'Jenkins',
  'Database Access',
  'Kubernetes',
  'HiBob',
  'Workday',
  'BambooHR',
  'Payroll System',
  'Slack',
  'Zoom',
  'Office 365',
  'Google Workspace',
];

export function RequestForm({ onCreated }: RequestFormProps) {
  const { showToast } = useToast();
  const [selectedApp, setSelectedApp] = useState('');
  const [customAppName, setCustomAppName] = useState('');
  const [justification, setJustification] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOther = selectedApp === 'Other';

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!selectedApp) {
      errs.applicationName = 'Please select an application.';
    } else if (isOther && customAppName.trim().length < 2) {
      errs.applicationName = 'Application name must be at least 2 characters.';
    }
    if (justification.trim().length < 10) {
      errs.justification = 'Justification must be at least 10 characters.';
    }
    if (justification.trim().length > 1000) {
      errs.justification = 'Justification must be 1000 characters or fewer.';
    }
    return errs;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const applicationName = isOther ? customAppName.trim() : selectedApp;

    setIsSubmitting(true);
    try {
      const request = await requestsService.create({
        applicationName,
        justification: justification.trim(),
      });
      setSelectedApp('');
      setCustomAppName('');
      setJustification('');
      onCreated(request);
      showToast('Your access request has been submitted successfully.', 'success');
    } catch (err) {
      showToast(extractMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Application dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Application Name
        </label>
        <select
          value={selectedApp}
          onChange={(e) => {
            setSelectedApp(e.target.value);
            setCustomAppName('');
            if (errors.applicationName) setErrors((p) => ({ ...p, applicationName: undefined }));
          }}
          disabled={isSubmitting}
          className={[
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors',
            'bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500',
            errors.applicationName
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300 focus:border-indigo-500',
            isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          <option value="">Select an application…</option>
          {CATALOG_APPS.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
          <option value="Other">Other…</option>
        </select>
        {errors.applicationName && (
          <p className="mt-1 text-xs text-red-600">{errors.applicationName}</p>
        )}
      </div>

      {/* Custom name field — only shown when "Other" is selected */}
      {isOther && (
        <Input
          label="Application name"
          placeholder="Enter the application name"
          value={customAppName}
          onChange={(e) => {
            setCustomAppName(e.target.value);
            if (errors.applicationName) setErrors((p) => ({ ...p, applicationName: undefined }));
          }}
          disabled={isSubmitting}
        />
      )}

      <Textarea
        label="Justification"
        placeholder="Describe why you need access to this application..."
        value={justification}
        onChange={(e) => {
          setJustification(e.target.value);
          if (errors.justification) setErrors((p) => ({ ...p, justification: undefined }));
        }}
        error={errors.justification}
        hint={`${justification.length}/1000`}
        rows={4}
        disabled={isSubmitting}
      />
      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting}>
          Submit Request
        </Button>
      </div>
    </form>
  );
}
