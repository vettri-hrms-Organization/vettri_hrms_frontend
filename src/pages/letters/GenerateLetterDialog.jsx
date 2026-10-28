import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, FileText } from 'lucide-react';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { lettersApi, LETTER_TYPE_LABEL, apiMessage, customFieldsIn } from '../../api/endpoints/letters';

function humanize(field) {
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Generate a letter for an employee: pick template, fill custom fields,
 * preview the server-rendered text, then generate the PDF (optionally emailing it).
 * `initialType` preselects the first active template of that letter type.
 */
export default function GenerateLetterDialog({ employee, initialType, onClose, onGenerated }) {
  const toast = useToast();
  const { data: templates, isLoading } = useQuery({ queryKey: ['letters', 'templates'], queryFn: lettersApi.templates });
  const active = useMemo(() => (templates || []).filter((t) => t.active && t.letterType !== 'OFFER'), [templates]);
  const [templateId, setTemplateId] = useState('');
  const [custom, setCustom] = useState({});
  const [sendEmail, setSendEmail] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!templateId && active.length) {
      const match = initialType ? active.find((t) => t.letterType === initialType) : null;
      setTemplateId(String((match || active[0]).id));
    }
  }, [active, initialType, templateId]);

  const template = active.find((t) => String(t.id) === templateId);
  const fields = template ? customFieldsIn(template.body) : [];
  const payload = () => ({
    templateId: Number(templateId),
    employeeId: employee.id,
    customFields: Object.fromEntries(fields.map((f) => [f, custom[f] || ''])),
    sendEmail,
  });

  const previewMutation = useMutation({
    mutationFn: () => lettersApi.preview(payload()),
    onSuccess: setPreview,
    onError: (error) => { setPreview(null); toast.error(apiMessage(error)); },
  });
  const generate = useMutation({
    mutationFn: () => lettersApi.generate(payload()),
    onSuccess: (letter) => {
      const emailNote = sendEmail
        ? (letter.emailStatus === 'SENT' ? ' and emailed' : ' (email could not be sent)')
        : '';
      toast.success(`${letter.title} generated${emailNote}.`);
      onGenerated?.(letter);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title="Generate letter"
      description={`For ${employee.fullName} (${employee.employeeCode})`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" icon={Eye} disabled={!template} loading={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
            Preview
          </Button>
          <Button icon={FileText} disabled={!template} loading={generate.isPending} onClick={() => generate.mutate()}>
            Generate PDF
          </Button>
        </>
      )}
    >
      {isLoading ? <SkeletonText lines={4} /> : (
        <div className="d-flex flex-column gap-3">
          <FormField as="select" label="Template" value={templateId} onChange={(v) => { setTemplateId(v); setPreview(null); }} required>
            {active.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({LETTER_TYPE_LABEL[t.letterType] || t.letterType})</option>
            ))}
          </FormField>
          {fields.map((field) => (
            <FormField
              key={field}
              label={humanize(field)}
              value={custom[field] || ''}
              onChange={(v) => { setCustom((c) => ({ ...c, [field]: v })); setPreview(null); }}
              required
              hint={`Fills {{custom.${field}}}`}
            />
          ))}
          <div className="form-check">
            <input id="letter-send-email" className="form-check-input" type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            <label className="form-check-label" htmlFor="letter-send-email">
              Email the PDF to {employee.email || 'the employee'}
            </label>
          </div>
          {preview && (
            <div>
              <div className="small text-muted mb-1">Preview</div>
              <div
                className="p-3 rounded"
                style={{ border: '1px solid var(--hz-border)', whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', fontFamily: 'Georgia, serif' }}
              >
                <strong className="d-block text-center mb-2">{preview.title}</strong>
                {preview.body}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
