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

interface FormState {
  applicationName: string;
  justification: string;
}

interface FormErrors {
  applicationName?: string;
  justification?: string;
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.applicationName.trim()) {
    errors.applicationName = 'Application name is required.';
  }
  if (values.justification.trim().length < 10) {
    errors.justification = 'Justification must be at least 10 characters.';
  }
  if (values.justification.trim().length > 1000) {
    errors.justification = 'Justification must be 1000 characters or fewer.';
  }
  return errors;
}

export function RequestForm({ onCreated }: RequestFormProps) {
  const { showToast } = useToast();
  const [values, setValues] = useState<FormState>({ applicationName: '', justification: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const request = await requestsService.create({
        applicationName: values.applicationName.trim(),
        justification: values.justification.trim(),
      });
      setValues({ applicationName: '', justification: '' });
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
      <Input
        label="Application Name"
        placeholder="e.g. Salesforce CRM, AWS Console"
        value={values.applicationName}
        onChange={handleChange('applicationName')}
        error={errors.applicationName}
        disabled={isSubmitting}
      />
      <Textarea
        label="Justification"
        placeholder="Describe why you need access to this application..."
        value={values.justification}
        onChange={handleChange('justification')}
        error={errors.justification}
        hint={`${values.justification.length}/1000`}
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
