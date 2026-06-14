import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Verify email — WarehouseJobs.com" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    void (async () => {
      try {
        const res = await apiClient.verifyEmail(token);
        setStatus("ok");
        setMessage(res.message);
        toast.success("Email verified — you can sign in now.");
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof ApiError ? err.message : "Verification failed. The link may have expired.",
        );
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Email verification</h1>
        <p className="mt-3 text-muted-foreground">{message}</p>
        {status === "ok" && (
          <Button className="mt-6" onClick={() => navigate({ to: "/auth", search: { mode: "login" } })}>
            Sign in
          </Button>
        )}
        {status === "error" && (
          <Link to="/auth" search={{ mode: "login" }} className="mt-6 inline-block text-primary underline">
            Back to sign in
          </Link>
        )}
      </div>
    </div>
  );
}
