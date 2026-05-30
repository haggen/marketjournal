import { c } from "@/lib/classes";
import type { ComponentProps } from "react";

const variants = {
  text: "",
  primary: "py-1 px-6 text-orange-100 bg-orange-700 hover:bg-orange-600 rounded-xs hard-shadow",
};

export function Button({
  variant = "text",
  type = "button",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return (
    <button
      type={type}
      className={c("font-bold hover:text-white active:opacity-50", variants[variant], className)}
      {...props}
    />
  );
}
