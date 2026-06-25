export type CheckoutIntent = "purchase" | "renew" | "upgrade";
export type CheckoutResult = { error: string; code?: "no_company" | "unauthorized" } | void;

/**
 * Stripe Checkout is pending migration to the NestJS API.
 * The Supabase `create-checkout` Edge Function has been removed.
 */
export async function startCheckout(
  _packageId: string,
  _intent: CheckoutIntent = "purchase",
  _pendingJobId?: string | null,
): Promise<CheckoutResult> {
  return {
    error:
      "Billing is being migrated to the new platform. Please contact support@warehousejobs.com to purchase a package.",
  };
}
