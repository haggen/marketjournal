import { useCallback, useRef, type Ref } from "react";

export function useExistingRef<T>(existingRef: Ref<T>) {
  const ref = useRef<T>(null);

  return [
    ref,
    useCallback(
      (value: T) => {
        ref.current = value;

        if (typeof existingRef === "function") {
          existingRef(value);
        } else if (existingRef) {
          existingRef.current = value;
        }
      },
      [existingRef],
    ),
  ] as const;
}
