import { Link, Outlet, useLocation } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "../store/taskStore";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Upload" },
  { to: "/review", label: "Review Board" },
  { to: "/my-tasks", label: "My Tasks" },
];

export function Layout() {
  const location = useLocation();
  const toast = useTaskStore((s) => s.toast);
  const setToast = useTaskStore((s) => s.setToast);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-highlight">TaskPulse</h1>
          <nav className="flex gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  location.pathname === item.to
                    ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {toast && (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <Alert className="border-success/40 bg-success/20 text-success">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{toast}</span>
              <Button variant="ghost" size="sm" onClick={() => setToast(null)}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
