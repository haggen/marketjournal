import { c } from "@/lib/classes";
import type { ComponentProps } from "react";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={c(
        "flex items-center h-9 px-1 text-white placeholder-white/50 rounded border [border-style:inset] border-stone-700 bg-stone-700 focus:bg-stone-800",
        className,
      )}
      {...props}
    />
  );
}
