import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { billingApi, loadRazorpay } from '../../api/endpoints/billing';
import { useToast } from '../ui/Toast';

/**
 * "Pay now" for the current renewal invoice: creates a Razorpay order on the
 * backend, opens checkout, then verifies the payment through the
 * authenticated renewal verify endpoint. COMPANY_ADMIN only (enforced server-side).
 */
export function usePayNow() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);

  async function payNow() {
    setPaying(true);
    try {
      const order = await billingApi.payNow();
      const Razorpay = await loadRazorpay();
      await new Promise((resolve) => {
        const checkout = new Razorpay({
          key: order.key,
          amount: order.amount,
          currency: order.currency,
          name: 'Vettri HRMS',
          description: order.description,
          order_id: order.orderId,
          prefill: { name: order.customerName, email: order.customerEmail },
          theme: { color: '#4169E1' },
          handler: async (response) => {
            try {
              await billingApi.verifyRenewal({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast.success('Payment received. Your subscription is active.');
            } catch (error) {
              toast.error(error.userMessage || error.message || 'Payment could not be verified. Please contact support.');
            } finally {
              queryClient.invalidateQueries({ queryKey: ['billing-status'] });
              queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
              queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
              resolve();
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        checkout.on('payment.failed', (response) => {
          toast.error(response?.error?.description || 'The payment failed. Please try another method.');
        });
        checkout.open();
      });
    } catch (error) {
      toast.error(error.userMessage || error.message || 'Unable to start the payment.');
    } finally {
      setPaying(false);
    }
  }

  return { payNow, paying };
}
