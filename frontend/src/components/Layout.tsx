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
    <div className="app-background min-h-screen w-full text-white">
      <div className="relative min-h-screen w-full">
        <header className="relative flex w-full items-center justify-between border-b border-[#1f2937] px-6 py-6 md:px-12">
          <span className="text-xl font-bold leading-7 text-white">TaskPulse</span>
          <nav className="flex items-center gap-4 md:gap-8">
            {nav.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "text-sm leading-5 transition-colors",
                    active
                      ? "rounded-lg bg-[#2563eb] px-4 py-2 font-medium text-white hover:bg-[#1d4ed8]"
                      : "text-white/90 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {toast && (
          <div className="relative mx-auto mt-4 max-w-5xl px-6 md:px-12">
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

        <main className="relative mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8 md:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
