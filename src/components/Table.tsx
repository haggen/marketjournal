import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export function Header({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={twMerge(
        "px-4 py-1 border border-dashed bg-clip-padding",
        className,
      )}
      {...props}
    />
  );
}

export function Cell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={twMerge(
        "px-4 py-1 border border-dashed bg-clip-padding",
        className,
      )}
      {...props}
    />
  );
}
