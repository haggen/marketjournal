import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={twMerge(
        "px-1 py-1 bg-black/30 border border-dashed focus-within:outline-none focus-within:bg-black/60",
        className,
      )}
      {...props}
    />
  );
}

export function Button({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={twMerge(
        "px-6 py-1 font-bold font-sm bg-yellow-600 border border-dashed hover:bg-yellow-500 hover:text-white active:opacity-50 animate-blink",
        className,
      )}
      {...props}
    />
  );
}
