import {
  useEffect,
  useRef,
  type ComponentProps,
  type KeyboardEvent,
  useReducer,
} from "react";
import { useFloating } from "@floating-ui/react";
import { twMerge } from "tailwind-merge";

export function Autocomplete({
  data,
  filter = (query, option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  ...props
}: {
  data: string[];
  filter?: (query: string, option: string) => boolean;
} & ComponentProps<"input">) {
  const [state, update] = useReducer(
    (state, patch) => ({ ...state, ...patch }),
    {
      query: "",
      open: false,
      highlighted: -1,
    },
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { floatingStyles } = useFloating({
    placement: "bottom-start",
    elements: {
      floating: floatingRef.current,
      reference: inputRef.current,
    },
  });

  useEffect(() => {
    const handleBlur = (event: FocusEvent | MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("focusin", handleBlur);
    document.addEventListener("click", handleBlur);

    return () => {
      document.removeEventListener("focusin", handleBlur);
      document.removeEventListener("click", handleBlur);
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    if (!state.open) {
      return;
    }

    const option = listRef.current.children[state.highlighted];
    if (option) {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [state.highlighted, state.open]);

  const setValue = (value: string) => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  };

  const handleOpen = () => {
    update({ open: true });
  };

  const handleClose = () => {
    update({ open: false });
  };

  const handleInput = (query: string) => {
    update({
      query,
      open: true,
      highlighted: Math.max(
        -1,
        Math.min(state.highlighted, options.length - 1),
      ),
    });
  };

  const handleComplete = (value: string) => {
    setValue(value);
    update({ open: false, query: "" });
  };

  const handleHighlight = (index: number) => {
    update({
      open: true,
      highlighted: Math.max(0, Math.min(index, options.length - 1)),
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (state.open) {
        event.preventDefault();
        handleHighlight(state.highlighted + 1);
      } else if (
        inputRef.current?.selectionStart === inputRef.current?.value.length
      ) {
        handleOpen();
      }
    } else if (event.key === "ArrowUp") {
      if (state.open) {
        event.preventDefault();
        handleHighlight(state.highlighted - 1);
      }
    } else if (event.key === "Enter") {
      if (state.open && state.highlighted >= 0) {
        event.preventDefault();
        const option = options[state.highlighted];
        if (option) {
          handleComplete(option);
        }
      }
    } else if (event.key === "Escape") {
      if (state.open) {
        event.preventDefault();
        handleClose();
      }
    }
  };

  const options = data
    .filter((option) => filter(state.query, option))
    .sort((a, b) => a.localeCompare(b));

  return (
    <div ref={containerRef} className="contents">
      <input
        ref={inputRef}
        onFocus={handleOpen}
        onInput={(e) => handleInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        {...props}
      />

      <div
        ref={floatingRef}
        className={twMerge(
          "m-1 rounded tear-off-mauve-600 shadow-lg",
          state.open ? "" : "hidden",
        )}
        style={floatingStyles}
      >
        <div
          ref={listRef}
          tabIndex={-1}
          role="listbox"
          className="p-1 overflow-y-auto overscroll-contain scroll-py-1 max-h-62 scrollbar-thin"
        >
          {options.map((option, index) => (
            <div
              key={option}
              role="option"
              className="px-2 cursor-default text-rose-100 rounded-sm tear-off-mauve-600 data-highlighted:tear-off-mauve-700 data-highlighted:text-white"
              onMouseMove={() => handleHighlight(index)}
              onMouseDown={() => handleComplete(option)}
              data-highlighted={state.highlighted === index || undefined}
            >
              {option}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
