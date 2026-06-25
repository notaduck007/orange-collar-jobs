import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-notification-preferences";

const TOGGLES = [
  { key: "emailTransactional" as const, label: "Email — account & applications" },
  { key: "emailMarketing" as const, label: "Email — job tips & promotions" },
  { key: "smsTransactional" as const, label: "SMS — application updates" },
  { key: "smsMarketing" as const, label: "SMS — promotions (opt-in)" },
  { key: "inApp" as const, label: "In-app inbox notifications" },
];

export function NotificationPreferencesForm({ testId }: { testId?: string }) {
  const prefsQ = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  if (prefsQ.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
      </div>
    );
  }

  if (prefsQ.isError || !prefsQ.data) {
    return (
      <p className="text-sm text-destructive">
        Could not load notification preferences. Sign in again or try later.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid={testId}>
      {TOGGLES.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <Label htmlFor={key} className="text-sm font-normal">
            {label}
          </Label>
          <Switch
            id={key}
            checked={prefsQ.data[key]}
            disabled={update.isPending}
            onCheckedChange={(checked) => update.mutate({ [key]: checked })}
          />
        </div>
      ))}
    </div>
  );
}
