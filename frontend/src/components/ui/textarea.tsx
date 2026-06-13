import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-[#1f2937] bg-[#111318] px-2.5 py-2 text-base text-[#9ca3af] transition-colors outline-none placeholder:text-[#6b7280] focus-visible:border-[#2563eb] focus-visible:ring-3 focus-visible:ring-[#2563eb]/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
