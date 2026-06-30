import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Parent layout for `/jobs`, `/jobs/$slug`, and `/jobs/category/$categorySlug`. */
export const Route = createFileRoute("/jobs")({
  component: JobsLayout,
});

function JobsLayout() {
  return <Outlet />;
}
