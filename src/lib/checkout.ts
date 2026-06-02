import { supabase } from "@/integrations/supabase/client";

export type CheckoutIntent = "purchase" | "renew" | "upgrade";
export type CheckoutResult = { error: string; code?: "no_company" | "unauthorized" } | void;

async function userHasCheckoutCompany(userId: string): Promise<boolean> {
  const { data: owned, error: ownedError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (owned?.id) return true;
  if (ownedError) return true;

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (membershipError) return true;
  return Boolean(membership?.company_id);
}

/**
 * Start a Stripe Checkout session for a package and redirect to Stripe.
 * Returns only on error (otherwise the page navigates away).
 */
export async function startCheckout(
  packageId: string,
  intent: CheckoutIntent = "purchase",
  pendingJobId?: string | null,
): Promise<CheckoutResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: "Please sign in to start checkout", code: "unauthorized" };

  const hasCompany = await userHasCheckoutCompany(userData.user.id);
  if (!hasCompany) return { error: "No company found for this user", code: "no_company" };

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
