import { c } from "@/lib/classes";
import type { ComponentProps } from "react";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={c(
        "p-1 text-white placeholder-white/50 bg-stone-700 rounded-xs hard-shadow-inset focus:bg-stone-800",
        className,
      )}
      {...props}
    />
  );
}
