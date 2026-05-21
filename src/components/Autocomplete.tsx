import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type InputEvent,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import { useFloating } from "@floating-ui/react";
import { twMerge } from "tailwind-merge";

const styles = {
  floating:
    "m-1 bg-mauve-600 bg-clip-padding border border-dashed border-mauve-600 shadow-lg",
  listbox: "p-1 overflow-y-auto overscroll-contain scroll-py-1 max-h-62",
  option:
    "px-2 cursor-default text-rose-100 border border-dashed border-mauve-600 data-highlighted:bg-mauve-700 data-highlighted:text-white",
};

export function Autocomplete({
  data,
  filter = (query, option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  ...props
}: {
  data: string[];
  filter?: (query: string, option: string) => boolean;
} & ComponentProps<"input">) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState(-1);
  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    elements: {
      reference: inputRef.current,
    },
  });

  const options = data
    .filter((option) => filter(query, option))
    .sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    if (!open || selected < 0) {
      return;
    }

    const option = listRef.current?.children.item(selected);

    if (option instanceof HTMLElement) {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [open, selected, options]);

  const setValue = (value: string) => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  };

  const handleInput = (event: InputEvent<HTMLInputElement>) => {
    setOpen(true);
    setSelected(-1);
    setQuery(event.currentTarget.value);
  };

  const handleConfirm = (value: string) => {
    setValue(value);
    setQuery("");
    setOpen(false);
  };

  const handleFocus = () => {
    setOpen(true);
    setQuery("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (options.length > 0) {
        setSelected((index) => Math.min(index + 1, options.length - 1));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length > 0) {
        setSelected((index) => Math.max(index - 1, 0));
      }
    } else if (event.key === "Enter" && selected >= 0) {
      if (open) {
        event.preventDefault();
        if (!options[selected]) {
          throw new Error("Highlighted option not found");
        }
        handleConfirm(options[selected]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Fragment>
      <input
        ref={inputRef}
        onFocus={handleFocus}
        onBlur={() => setOpen(false)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        {...props}
      />

      <div
        ref={refs.setFloating}
        className={twMerge(styles.floating, open ? "" : "hidden")}
        style={floatingStyles}
      >
        <div
          ref={listRef}
          tabIndex={-1}
          role="listbox"
          className={styles.listbox}
          onMouseLeave={() => {
            lastMousePositionRef.current = null;
          }}
        >
          {options.map((option, index) => (
            <div
              key={option}
              role="option"
              className={styles.option}
              onMouseMove={() => setSelected(index)}
              onMouseDown={() => handleConfirm(option)}
              data-highlighted={selected === index || undefined}
            >
              {option}
            </div>
          ))}
        </div>
      </div>
    </Fragment>
  );
}
