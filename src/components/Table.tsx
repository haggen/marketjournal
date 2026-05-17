import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export function Header({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={twMerge("px-3 border border-dashed", className)}
      {...props}
    />
  );
}

export function Cell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={twMerge("px-3 border border-dashed", className)}
      {...props}
    />
  );
}
