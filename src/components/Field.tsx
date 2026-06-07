import { c } from "@/lib/classes";
import { useId, type ReactNode } from "react";

export function Field({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: (props: { id: string }) => ReactNode;
}) {
  const id = useId();

  return (
    <div className={c("flex flex-col", className)}>
      <label htmlFor={id} className="text-xs leading-loose">
        {label}
      </label>
      {children({ id })}
    </div>
  );
}
