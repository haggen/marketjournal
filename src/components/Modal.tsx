import { type ComponentProps } from "react";
import { c } from "@/lib/classes";

export type ModalHandle = {
  show(): void;
  hide(): void;
  toggle(): void;
};

export function Modal({ ref, className, ...props }: ComponentProps<"dialog">) {
  return (
    <dialog
      ref={ref}
      className={c(
        "m-auto text-current bg-stone-600 rounded-xs backdrop:bg-black/50",
        className,
      )}
      {...props}
    />
  );
}
