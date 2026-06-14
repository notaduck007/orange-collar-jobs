import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Reset password — WarehouseJobs.com" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Missing reset token. Use the link from your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.resetPassword(token, password);
      toast.success(res.message);
      navigate({ to: "/auth", search: { mode: "login" } });
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not reset password. The link may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="mt-3 text-muted-foreground">
            This page needs a token from your reset email. Request a new link from sign in.
          </p>
          <Link to="/forgot-password" className="mt-6 inline-block text-primary underline">
            Request reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a strong password for your account.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
        <Link
          to="/auth"
          search={{ mode: "login" }}
          className="mt-6 block text-center text-sm text-primary underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
