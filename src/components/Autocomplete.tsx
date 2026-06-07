import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useReducer,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useFloating } from "@floating-ui/react";
import { Input } from "@/components/Input";

type State = {
  query: string;
  open: boolean;
  highlighted: number;
  scrollViewBlock: "nearest" | "center";
};

type Context = {
  state: State;
  options: string[];
  containerRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  floatingRef: RefObject<HTMLDivElement | null>;
  listRef: RefObject<HTMLDivElement | null>;
  floatingStyles: CSSProperties;
  handleOpen: () => void;
  handleClose: () => void;
  handleInput: (query: string) => void;
  handleComplete: (value: string) => void;
  handleHighlight: (index: number) => void;
  handleKeyDown: (event: { key: string; preventDefault: () => void }) => void;
};

const Context = createContext<Context | null>(null);

function useAutocomplete() {
  const context = useContext(Context);
  if (!context) {
    throw new Error("Autocomplete components must be used within Autocomplete.Root");
  }
  return context;
}

function defaultFilter(query: string, option: string) {
  return option.toLowerCase().startsWith(query.toLowerCase());
}

function AutocompleteRoot({
  data,
  filter = defaultFilter,
  children,
}: {
  data: string[];
  filter?: (query: string, option: string) => boolean;
  children: ReactNode;
}) {
  const [state, update] = useReducer(
    (state: State, patch: Partial<State>) => ({ ...state, ...patch }),
    { query: "", open: false, highlighted: -1, scrollViewBlock: "nearest" },
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
    if (!listRef.current || !state.open) {
      return;
    }

    const option = listRef.current.children[state.highlighted];
    if (option) {
      option.scrollIntoView({ block: state.scrollViewBlock });
    }
  }, [state.highlighted, state.open]);

  const options = data
    .filter((option) => filter(state.query, option))
    .sort((a, b) => a.localeCompare(b));

  const getValue = () => {
    return inputRef.current?.value ?? "";
  };

  const setValue = (value: string) => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  };

  const handleOpen = () => {
    update({
      open: true,
      scrollViewBlock: "center",
      highlighted: options.findIndex((option) => option === getValue()),
    });
  };

  const handleClose = () => {
    update({ open: false });
  };

  const handleInput = (query: string) => {
    update({
      query,
      open: true,
      highlighted: Math.max(-1, Math.min(state.highlighted, options.length - 1)),
    });
  };

  const handleComplete = (value: string) => {
    setValue(value);
    update({ open: false, query: "" });
  };

  const handleHighlight = (index: number) => {
    update({
      open: true,
      scrollViewBlock: "nearest",
      highlighted: Math.max(0, Math.min(index, options.length - 1)),
    });
  };

  const handleKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (event.key === "ArrowDown") {
      if (state.open) {
        event.preventDefault();
        handleHighlight(state.highlighted + 1);
      } else if (inputRef.current?.selectionStart === inputRef.current?.value.length) {
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

  return (
    <Context.Provider
      value={{
        state,
        options,
        containerRef,
        inputRef,
        floatingRef,
        listRef,
        floatingStyles,
        handleOpen,
        handleClose,
        handleInput,
        handleComplete,
        handleHighlight,
        handleKeyDown,
      }}
    >
      <div ref={containerRef} className="contents">
        {children}
      </div>
    </Context.Provider>
  );
}

function AutocompleteInput(props: ComponentProps<"input">) {
  const { inputRef, handleOpen, handleInput, handleKeyDown } = useAutocomplete();

  return (
    <Input
      ref={inputRef}
      onFocus={handleOpen}
      onInput={(e) => handleInput(e.currentTarget.value)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

function AutocompleteList() {
  const { floatingRef, floatingStyles, listRef, options, state, handleHighlight, handleComplete } =
    useAutocomplete();

  return (
    <div
      ref={floatingRef}
      className="mt-1 bg-orange-800 z-10"
      style={floatingStyles}
      hidden={!state.open}
    >
      <div
        ref={listRef}
        tabIndex={-1}
        role="listbox"
        className="overflow-y-auto overscroll-contain scroll-py-1 max-h-62 min-w-3xs scrollbar-thin"
      >
        {options.length > 0 ? (
          options.map((option, index) => (
            <div
              key={option}
              role="option"
              className="px-2 flex items-center h-9 cursor-default data-highlighted:bg-black/10 data-highlighted:text-white"
              onMouseMove={() => handleHighlight(index)}
              onMouseDown={() => handleComplete(option)}
              data-highlighted={state.highlighted === index || undefined}
            >
              {option}
            </div>
          ))
        ) : (
          <div className="px-1 text-white/50">No results.</div>
        )}
      </div>
    </div>
  );
}

export const Autocomplete = {
  Root: AutocompleteRoot,
  Input: AutocompleteInput,
  List: AutocompleteList,
};
