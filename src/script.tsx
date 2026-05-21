import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useMemo,
  type SubmitEvent,
  type Ref,
  useImperativeHandle,
  type ComponentProps,
  type KeyboardEvent,
  type ChangeEvent,
  type FocusEvent,
  type MouseEvent,
  Fragment,
} from "react";
import { createRoot } from "react-dom/client";
import {
  addEntry,
  createEmptyData,
  deleteItem,
  deleteLocation,
  getGlobalMarket,
  getInitialData,
  getLocalMarket,
  getMarketGap,
  migrate,
  type Data,
  type Entry,
} from "@/lib/data";
import { immutable } from "@/lib/immutable";
import { fmt } from "@/lib/fmt";
import z from "zod";
import { getFormElement, setFormValue } from "./lib/form";
import { twMerge } from "tailwind-merge";
import { ArrowUpDownIcon, CircleXIcon, XIcon } from "lucide-react";
import { useFloating } from "@floating-ui/react";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(<App />);

const styles = {
  th: "px-3 border border-dashed",
  td: "border border-dashed",
  input:
    "px-1 py-1 text-white bg-black/30 border border-dashed focus-within:outline-none focus-within:bg-black/60",
  button:
    "px-6 py-1 font-bold font-sm bg-yellow-600 border border-dashed hover:bg-yellow-500 hover:text-white active:opacity-50 animate-blink",
  Autocomplete: {
    Popup:
      "m-1 bg-mauve-600 bg-clip-padding border border-dashed border-mauve-600 shadow-lg",
    List: "p-1 overflow-y-auto overscroll-contain scroll-py-1 max-h-62",
    Item: "px-2 cursor-default text-rose-100 border border-dashed border-mauve-600 data-highlighted:bg-mauve-700 data-highlighted:text-white",
  },
};

function Autocomplete({
  data,
  ...props
}: { data: string[] } & ComponentProps<"input">) {
  const [internalValue, setInternalValue] = useState("");
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
    .filter((option) =>
      option.toLowerCase().includes(internalValue.toLowerCase() ?? ""),
    )
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

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setOpen(true);
    setSelected(-1);
    setInternalValue(event.currentTarget.value);
  };

  const handleConfirm = (value: string) => {
    setValue(value);
    setInternalValue("");
    setOpen(false);
  };

  const handleFocus = () => {
    setOpen(true);
    setInternalValue("");
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
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />

      <div
        ref={refs.setFloating}
        className={twMerge(styles.Autocomplete.Popup, open ? "" : "hidden")}
        style={floatingStyles}
      >
        <div
          ref={listRef}
          tabIndex={-1}
          role="listbox"
          className={styles.Autocomplete.List}
          onMouseLeave={() => {
            lastMousePositionRef.current = null;
          }}
        >
          {options.map((option, index) => (
            <div
              key={option}
              role="option"
              className={styles.Autocomplete.Item}
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

function Form({
  ref,
  onEntry,
  lists,
}: {
  ref: Ref<{
    prefill(entry: Omit<Entry, "timestamp">): void;
  }>;
  onEntry: (entry: Entry) => void;
  lists: { items: string[]; locations: string[] };
}) {
  const [submittedAt, setSubmittedAt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      prefill(entry: Omit<Entry, "timestamp">) {
        if (formRef.current) {
          setFormValue(formRef.current, "location", entry.location);
          setFormValue(formRef.current, "item", entry.item);
          setFormValue(formRef.current, "bid", entry.price.bid.toString());
          setFormValue(formRef.current, "ask", entry.price.ask.toString());

          formRef.current.scrollIntoView();
          getFormElement(formRef.current, "bid").select();
        }
      },
    }),
    [],
  );

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    const payload = {
      timestamp: Date.now(),
      location: z.string().min(1).parse(data.get("location")),
      item: z.string().min(1).parse(data.get("item")),
      price: {
        bid: z.coerce.number().min(1).parse(data.get("bid")),
        ask: z.coerce.number().min(1).parse(data.get("ask")),
      },
    };

    onEntry(payload);

    setFormValue(event.currentTarget, "item", "");
    setFormValue(event.currentTarget, "bid", "");
    setFormValue(event.currentTarget, "ask", "");

    getFormElement(event.currentTarget, "item").focus();

    setSubmittedAt(Date.now());
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <fieldset className="flex gap-2 justify-center px-3 py-2 bg-olive-600 border border-dashed border-mist-800 items-end">
        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">Location:</span>
          <Autocomplete
            className={twMerge(styles.input, "flex-1 border-olive-600")}
            type="text"
            name="location"
            required
            data={lists.locations}
          />
        </label>

        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">Item:</span>
          <Autocomplete
            className={twMerge(styles.input, "flex-1 border-olive-600")}
            type="text"
            name="item"
            required
            data={lists.items}
          />
        </label>

        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">Sell price:</span>
          <input
            className={twMerge(styles.input, "flex-1 border-olive-600")}
            type="number"
            name="bid"
            required
            min="1"
          />
        </label>
        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">Buy price:</span>
          <input
            className={twMerge(styles.input, "flex-1 border-olive-600")}
            type="number"
            name="ask"
            required
            min="1"
          />
        </label>
        <button
          key={submittedAt}
          type="submit"
          className={twMerge(styles.button, "border-olive-600")}
        >
          Save entry
        </button>
      </fieldset>
    </form>
  );
}

export function Header({
  justify,
  children,
  onDelete,
}: {
  justify?: "start" | "center";
  children: string;
  onDelete: () => void;
}) {
  return (
    <div
      className={twMerge(
        "grid gap-2 items-center group",
        justify === "start"
          ? "grid-cols-[auto_1fr]"
          : "grid-cols-[1fr_auto_1fr]",
      )}
    >
      <div
        className={twMerge(
          "text-xs leading-loose",
          justify === "start" ? "" : "col-2 justify-self-end",
        )}
      >
        {children}
      </div>

      <div
        className={twMerge(
          "justify-self-start not-group-hover:invisible",
          justify === "start" ? "" : "col-3",
        )}
      >
        <button
          className="block text-stone-400 hover:text-white active:opacity-50"
          type="button"
          onClick={() => onDelete()}
        >
          <XIcon strokeWidth={5} size={12} />
        </button>
      </div>
    </div>
  );
}

type Action =
  | { type: "import"; payload: Data }
  | { type: "add"; payload: Entry }
  | { type: "delete-item"; payload: string }
  | { type: "delete-location"; payload: string }
  | { type: "clear" };

function reducer(data: Data, action: Action) {
  switch (action.type) {
    case "import":
      return action.payload;
    case "add":
      return immutable(data, (data) => {
        addEntry(data, action.payload);
        return data;
      });
    case "delete-item":
      return immutable(data, (data) => {
        deleteItem(data, action.payload);
        return data;
      });
    case "delete-location":
      return immutable(data, (data) => {
        deleteLocation(data, action.payload);
        return data;
      });
    case "clear":
      return createEmptyData();
    default:
      return data;
  }
}

function App() {
  const [data, dispatch] = useReducer(reducer, null, getInitialData);
  const formRef = useRef<{ prefill(entry: Omit<Entry, "timestamp">): void }>(
    null,
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    localStorage.setItem("data", JSON.stringify(data));
  }, [data]);

  const onEntry = (payload: Entry) => {
    dispatch({ type: "add", payload });
  };

  const items = useMemo(() => {
    return [...data.items]
      .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const marketA = getGlobalMarket(data, a);
        const marketB = getGlobalMarket(data, b);

        return marketB.max.bid - marketA.max.bid;
      });
  }, [data, query]);

  const handlePrefill = (
    location: string,
    item: string,
    price?: { bid: number; ask: number },
  ) => {
    if (formRef.current) {
      formRef.current.prefill({
        location,
        item,
        price: price ?? { bid: 0, ask: 0 },
      });
    }
  };

  const handleExport = () => {
    navigator.clipboard.writeText(JSON.stringify(data));
  };

  const handleImport = () => {
    navigator.clipboard
      .readText()
      .then((src) => {
        if (src.startsWith("http://")) {
          fetch(src, { headers: { accept: "text/json, application/json" } })
            .then((response) => {
              if (response.ok) {
                response.text().then((src) => {
                  const parsed = JSON.parse(src);
                  migrate(parsed);
                  dispatch({ type: "import", payload: parsed as Data });
                });
              }
            })
            .catch(console.error);
        } else {
          const parsed = JSON.parse(src);
          migrate(parsed);
          dispatch({ type: "import", payload: parsed as Data });
        }
      })
      .catch(console.error);
  };

  return (
    <main className="mx-auto flex flex-col gap-6 px-6 py-12">
      <header className="grid grid-cols-3">
        <h1 className="text-center text-3xl font-medium col-start-2">
          Market Journal
        </h1>
        <div className="flex gap-4 items-center justify-end">
          <button
            className="hover:text-white active:opacity-50"
            onClick={() => handleImport()}
          >
            Import
          </button>
          <button
            className="hover:text-white active:opacity-50"
            onClick={() => handleExport()}
          >
            Export
          </button>
        </div>
      </header>

      <Form
        ref={formRef}
        onEntry={onEntry}
        lists={{ items: data.items, locations: data.locations }}
      />

      <hr className="h-1 border border-mist-800 bg-mist-600 border-dashed" />

      <div className="-m-2">
        <table className="table-fixed border-separate w-full border-spacing-2">
          <thead>
            <tr>
              <th
                className={twMerge(
                  styles.th,
                  "font-normal border-mist-800 bg-mist-700",
                )}
                rowSpan={2}
              >
                <div className="flex items-center gap-1">
                  <input
                    type="search"
                    placeholder="Everything..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 text-sm placeholder:text-mist-400 focus-within:outline-none"
                  />
                  {query !== "" ? (
                    <button onClick={() => setQuery("")}>
                      <CircleXIcon size={16} />
                    </button>
                  ) : null}
                </div>
              </th>
              <th
                className={twMerge(styles.th, "border-mist-800 bg-mist-700")}
                colSpan={Math.max(1, data.locations.length)}
              >
                Prices
              </th>
            </tr>
            <tr>
              {data.locations.map((location) => (
                <th
                  className={twMerge(styles.th, "border-mist-800 bg-stone-600")}
                  key={location}
                >
                  <Header
                    justify="center"
                    onDelete={() =>
                      dispatch({ type: "delete-location", payload: location })
                    }
                  >
                    {location}
                  </Header>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item} className="group/row hover:text-white">
                <th
                  className={twMerge(
                    styles.th,
                    "text-left border-mist-800 bg-stone-600 group-hover/row:bg-gray-600",
                  )}
                >
                  <Header
                    justify="start"
                    onDelete={() =>
                      dispatch({ type: "delete-item", payload: item })
                    }
                  >
                    {item}
                  </Header>
                </th>
                {data.locations.map((location) => {
                  const local = getLocalMarket(data, item, location);
                  const spread = getMarketGap(data, item, location);

                  return (
                    <td
                      className={twMerge(
                        styles.td,
                        "text-center border-mist-800 bg-mist-900 group-hover/row:bg-gray-600/30 hover:bg-gray-600/60",
                      )}
                      key={`${location}-${item}`}
                      onClick={() =>
                        handlePrefill(location, item, local?.latest)
                      }
                    >
                      {local.latest.ask > 0 ? (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <div className="justify-self-end flex items-center gap-2">
                            <div
                              className="text-xs text-sky-500 justify-self-end"
                              title="Premium compared to the lowest sell price."
                            >
                              {spread.bid > 0
                                ? "+" +
                                  fmt.number(spread.bid / local.latest.bid, {
                                    style: "percent",
                                  })
                                : null}
                            </div>

                            <div title="Sell price">
                              {fmt.number(local.latest.bid)}
                            </div>
                          </div>

                          <div className="text-mist-400">
                            <ArrowUpDownIcon strokeWidth={3} size={12} />
                          </div>
                          <div className="flex items-center gap-2">
                            <div title="Buy price">
                              {fmt.number(local.latest.ask)}
                            </div>

                            <div
                              className="text-xs text-lime-500 justify-self-start"
                              title="Discount compared to the highest buy price."
                            >
                              {spread.ask > 0
                                ? fmt.number(
                                    (spread.ask / local.latest.ask) * -1,
                                    { style: "percent" },
                                  )
                                : null}
                            </div>
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
