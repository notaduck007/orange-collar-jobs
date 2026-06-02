// Builds Stripe dashboard URLs that match the active Stripe environment.
// Set VITE_STRIPE_MODE="live" for live mode; anything else (default) uses test mode.
const STRIPE_MODE = (import.meta.env.VITE_STRIPE_MODE ?? "test").toLowerCase();
const STRIPE_BASE =
  STRIPE_MODE === "live"
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";

export function stripePaymentIntentUrl(intentId: string): string {
  return `${STRIPE_BASE}/payments/${intentId}`;
}

export function stripeCheckoutSessionUrl(sessionId: string): string {
  return `${STRIPE_BASE}/checkout/sessions/${sessionId}`;
}

export function stripeDashboardUrlFor(opts: {
  paymentIntent?: string | null;
  sessionId?: string | null;
}): string | null {
  if (opts.paymentIntent) return stripePaymentIntentUrl(opts.paymentIntent);
  if (opts.sessionId) return stripeCheckoutSessionUrl(opts.sessionId);
  return null;
}
