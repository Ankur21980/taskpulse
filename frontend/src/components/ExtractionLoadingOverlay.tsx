import { Loader2 } from "lucide-react";

interface Props {
  message: string;
}

export function ExtractionLoadingOverlay({ message }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-xl border border-[#1f2937] bg-[#111318] px-8 py-10">
        <Loader2 className="size-10 animate-spin text-[#2563eb]" aria-hidden="true" />
        <p className="text-center text-sm leading-6 text-[#9ca3af]">{message}</p>
      </div>
    </div>
  );
}
