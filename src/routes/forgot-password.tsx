import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — WarehouseJobs.com" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.forgotPassword(email);
      setSent(true);
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a link to reset your password.
        </p>

        {sent ? (
          <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm">
            If an account exists for that email, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <Link to="/auth" search={{ mode: "login" }} className="mt-6 block text-center text-sm text-primary underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
