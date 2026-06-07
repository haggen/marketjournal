import { c } from "@/lib/classes";
import type { ComponentProps } from "react";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={c(
        "flex items-center h-9 px-2 text-white placeholder-white/50 bg-black/30 focus:bg-black/50",
        className,
      )}
      {...props}
    />
  );
}
