import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function Header({
  justify,
  children,
  trailing,
}: {
  justify?: "start" | "center";
  children: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={twMerge(
        "grid gap-2 items-center",
        justify === "start"
          ? "grid-cols-[auto_1fr]"
          : "grid-cols-[1fr_auto_1fr]",
      )}
    >
      <div
        className={twMerge(
          "text-xs leading-loose",
          justify === "start" ? "" : "col-start-2 justify-self-end",
        )}
      >
        {children}
      </div>

      <div
        className={twMerge(
          "flex gap-1 justify-self-start not-group-hover:invisible text-neutral-300 *:hover:text-white *:active:opacity-50",
          justify === "start" ? "" : "col-start-3",
        )}
      >
        {trailing}
      </div>
    </div>
  );
}
