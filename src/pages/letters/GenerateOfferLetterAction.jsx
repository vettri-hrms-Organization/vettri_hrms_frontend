import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, FileSignature } from 'lucide-react';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { SkeletonText } from '../../components/ui/Skeleton';
import { lettersApi, apiMessage, customFieldsIn } from '../../api/endpoints/letters';

/**
 * Candidate details → "Generate offer letter": renders an OFFER template
 * with the candidate's offer terms into a PDF and attaches it as the
 * candidate's offer letter, ready for the existing "Send Offer Letter".
 */
export default function GenerateOfferLetterAction({ candidate, onGenerated, label = 'Generate from template' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" icon={FileSignature} onClick={() => setOpen(true)}>{label}</Button>
      {open && (
        <GenerateOfferLetterDialog
          candidate={candidate}
          onClose={() => setOpen(false)}
          onGenerated={() => { setOpen(false); onGenerated?.(); }}
        />
      )}
    </>
  );
}

function GenerateOfferLetterDialog({ candidate, onClose, onGenerated }) {
  const { data: templates, isLoading, isError } = useQuery({ queryKey: ['letters', 'offer-templates'], queryFn: lettersApi.offerTemplates });
  const [templateId, setTemplateId] = useState('');
  const [custom, setCustom] = useState({});
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!templateId && templates?.length) setTemplateId(String(templates[0].id));
  }, [templates, templateId]);

  const template = (templates || []).find((t) => String(t.id) === templateId);
  const fields = template ? customFieldsIn(template.body) : [];
  const payload = () => ({
    templateId: templateId ? Number(templateId) : undefined,
    customFields: Object.fromEntries(fields.map((f) => [f, custom[f] || ''])),
  });

  const previewMutation = useMutation({
    mutationFn: () => lettersApi.previewOffer(candidate.id, payload()),
    onSuccess: (data) => { setError(null); setPreview(data); },
    onError: (err) => { setPreview(null); setError(apiMessage(err)); },
  });
  const generate = useMutation({
    mutationFn: () => lettersApi.generateOffer(candidate.id, payload()),
    onSuccess: () => onGenerated(),
    onError: (err) => setError(apiMessage(err)),
  });

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title="Generate offer letter"
      description={`Uses ${candidate.firstName || 'the candidate'}'s offer terms. The PDF replaces the current offer letter; send it with "Send Offer Letter".`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" icon={Eye} disabled={!template} loading={previewMutation.isPending} onClick={() => previewMutation.mutate()}>Preview</Button>
          <Button icon={FileSignature} disabled={!template} loading={generate.isPending} onClick={() => generate.mutate()}>Generate PDF</Button>
        </>
      )}
    >
      {isLoading && <SkeletonText lines={3} />}
      {isError && <div className="text-danger small">Could not load offer letter templates.</div>}
      {!isLoading && templates?.length === 0 && (
        <div className="small text-muted">No active offer letter template. Ask HR to add one under Settings → Letter templates.</div>
      )}
      {templates?.length > 0 && (
        <div className="d-flex flex-column gap-3">
          {error && (
            <div className="px-3 py-2" role="alert" style={{ background: 'var(--hz-danger-50)', color: 'var(--hz-danger-600)', borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}
          <FormField as="select" label="Template" value={templateId} onChange={(v) => { setTemplateId(v); setPreview(null); }}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </FormField>
          {fields.map((field) => (
            <FormField key={field} label={field} value={custom[field] || ''} onChange={(v) => { setCustom((c) => ({ ...c, [field]: v })); setPreview(null); }} required />
          ))}
          {preview && (
            <div
              className="p-3 rounded"
              style={{ border: '1px solid var(--hz-border)', whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', fontFamily: 'Georgia, serif' }}
            >
              <strong className="d-block text-center mb-2">{preview.title}</strong>
              {preview.body}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
