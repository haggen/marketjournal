import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={twMerge(
        "px-2 py-1 bg-olive-800 border-olive-800 border border-dashed bg-clip-padding focus-within:outline-none focus-within:bg-olive-800/50 focus-within:border-olive-800/50",
        className,
      )}
      {...props}
    />
  );
}
