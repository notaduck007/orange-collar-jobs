import { supabase } from "@/integrations/supabase/client";

export type CheckoutIntent = "purchase" | "renew" | "upgrade";

/**
 * Start a Stripe Checkout session for a package and redirect to Stripe.
 * Returns only on error (otherwise the page navigates away).
 */
export async function startCheckout(
  packageId: string,
  intent: CheckoutIntent = "purchase",
  pendingJobId?: string | null,
): Promise<{ error: string } | void> {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: {
      package_id: packageId,
      intent,
      pending_job_id: pendingJobId ?? null,
    },
  });
  if (error) return { error: error.message ?? "Could not start checkout" };
  if (!data?.url) return { error: "No checkout URL returned" };
  window.location.href = data.url;
}
