import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { whatsappApi } from '../../api/endpoints/whatsapp';
import { formatDateTimeIST } from '../../utils/formatDateTime';

/** Self-service WhatsApp opt-in (explicit consent + number with country code, as WhatsApp policy requires). */
export default function WhatsAppOptInCard() {
  const queryClient = useQueryClient();
  const optIn = useQuery({ queryKey: ['whatsapp-opt-in'], queryFn: whatsappApi.optIn });
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (optIn.data?.phone) setPhone(optIn.data.phone);
  }, [optIn.data?.phone]);

  const update = useMutation({
    mutationFn: ({ next, number }) => whatsappApi.updateOptIn(next, number),
    onSuccess: (data) => { queryClient.setQueryData(['whatsapp-opt-in'], data); setConsent(false); },
  });

  if (optIn.isLoading || optIn.isError || !optIn.data?.channelAvailable) return null;
  const active = optIn.data.optedIn;

  return (
    <Card title="WhatsApp notifications" subtitle="Get leave, payslip, expense and urgent updates on WhatsApp.">
      {active ? (
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span>Sending to <strong>{optIn.data.phone}</strong> since {formatDateTimeIST(optIn.data.optedInAt)}.</span>
          <Button variant="secondary" size="sm" loading={update.isPending} onClick={() => update.mutate({ next: false })}>Stop WhatsApp messages</Button>
        </div>
      ) : (
        <form className="d-flex flex-column gap-2" onSubmit={(event) => { event.preventDefault(); update.mutate({ next: true, number: phone }); }}>
          <label htmlFor="whatsapp-phone" className="form-label mb-0" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500 }}>
            WhatsApp number with country code
          </label>
          <input id="whatsapp-phone" type="tel" className="form-control" style={{ maxWidth: 280 }} placeholder="+919876543210"
            value={phone} onChange={(event) => setPhone(event.target.value)} />
          <label className="form-check-label d-flex gap-2" style={{ fontSize: 'var(--hz-text-sm)' }}>
            <input type="checkbox" className="form-check-input" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            I agree to receive HR notifications from my employer on WhatsApp. I can stop them at any time.
          </label>
          <div><Button type="submit" size="sm" disabled={!consent || !phone.trim()} loading={update.isPending}>Turn on WhatsApp</Button></div>
        </form>
      )}
      {update.isError && (
        <p role="alert" className="text-danger mt-2 mb-0">
          {update.error?.response?.data?.message || "Couldn't update your WhatsApp preference."}
        </p>
      )}
    </Card>
  );
}
