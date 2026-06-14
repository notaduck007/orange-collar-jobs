import { Link } from "@tanstack/react-router";
import { CheckCircle2, CalendarClock, BellRing, ListChecks, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApplySuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingStartsAt?: string | null;
}

function formatBooking(starts_at: string) {
  return new Date(starts_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ApplySuccessDialog({
  open,
  onOpenChange,
  bookingStartsAt,
}: ApplySuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </div>
          <DialogTitle className="text-center text-xl">You're in! Application sent 🎉</DialogTitle>
          <DialogDescription className="text-center">
            The employer reviews applicants and reaches out by phone or email. You can track status
            anytime under <span className="font-medium text-foreground">My Applications</span>.
          </DialogDescription>
        </DialogHeader>

        {bookingStartsAt && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">
                Phone screen booked for {formatBooking(bookingStartsAt)}
              </span>{" "}
              — we'll remind you.
            </span>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button asChild className="w-full">
            <Link to="/seeker/applications" onClick={() => onOpenChange(false)}>
              <ListChecks className="mr-1.5 h-4 w-4" aria-hidden />
              View my applications
            </Link>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link to="/seeker/alerts" onClick={() => onOpenChange(false)}>
                <BellRing className="mr-1.5 h-4 w-4" aria-hidden />
                Set a job alert
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/jobs" onClick={() => onOpenChange(false)}>
                <Search className="mr-1.5 h-4 w-4" aria-hidden />
                Keep browsing
              </Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
