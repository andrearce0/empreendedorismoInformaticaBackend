import Stripe from 'stripe';
import { config } from '../config.js';

const stripe = new Stripe(config.stripeSecretKey, {
    apiVersion: '2026-01-28.clover', // Use a recent version
});

export class StripeService {
    /**
     * Cria um PaymentIntent com captura manual (authorize).
     * @param amount Valor em centavos.
     * @param currency Moeda (ex: 'brl').
     * @param metadata Dados adicionais da sessão/pedido.
     */
    static async createPaymentIntent(amount: number, currency = 'brl', metadata: any = {}) {
        return await stripe.paymentIntents.create({
            amount,
            currency,
            payment_method_types: ['card'],
            capture_method: 'manual', // RETÉM OS FUNDOS
            metadata,
        });
    }

    /**
     * Captura os fundos autorizados.
     * @param paymentIntentId ID do PaymentIntent.
     * @param amount Valor a ser capturado (pode ser menor ou igual ao autorizado).
     */
    static async capturePaymentIntent(paymentIntentId: string, amount?: number) {
        const params: Stripe.PaymentIntentCaptureParams = {};
        if (amount !== undefined) {
            params.amount_to_capture = amount;
        }
        return await stripe.paymentIntents.capture(paymentIntentId, params);
    }

    /**
     * Cancela e libera os fundos autorizados.
     * @param paymentIntentId ID do PaymentIntent.
     */
    static async cancelPaymentIntent(paymentIntentId: string) {
        return await stripe.paymentIntents.cancel(paymentIntentId);
    }
}
