import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type InputEvent,
  type Ref,
} from "react";
import {
  addEntry,
  createEmptyData,
  deleteItem,
  deleteLocation,
  getNetProfit,
  loadStoredData,
  matchItem,
  migrate,
  type Data,
  type Entry,
  deleteEntry,
  getGlobalMarket,
  getMarketGap,
  getLocalMarket,
} from "@/lib/data";
import { immutable } from "@/lib/immutable";
import { Form, type FormHandle } from "@/components/Form";
import { Button } from "@/components/Button";
import { fmt } from "@/lib/fmt";
import { Modal } from "@/components/Modal";
import { useExistingRef } from "@/lib/existingRef";
import { c } from "@/lib/classes";

function HistoryModal({
  ref,
  subject,
  entries,
  getRelatedValue,
  onDeleteSubject,
  onDeleteEntry,
}: {
  ref: Ref<HTMLDialogElement>;
  subject: string;
  entries: Entry[];
  getRelatedValue: (entry: Entry) => string;
  onDeleteSubject: (subject: string) => void;
  onDeleteEntry: (entry: Entry) => void;
}) {
  const [dialogRef, setDialogRef] = useExistingRef(ref);

  return (
    <Modal ref={setDialogRef}>
      <div className="flex flex-col gap-2 p-4 max-h-96 w-xl">
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold truncate">{subject}</h1>

          <Button
            className="text-xl px-2"
            onClick={() => {
              dialogRef.current?.close();
            }}
          >
            &times;
          </Button>
        </header>

        <div className="flex-1 bg-stone-700 rounded overflow-y-auto scrollbar-gutter-stable">
          {entries.length > 0 ? (
            <div role="grid" className="text-xs">
              {entries.map((entry) => (
                <div
                  key={entry.timestamp}
                  role="row"
                  className="grid grid-cols-[1fr_1fr_1fr_auto] h-8 items-center even:bg-black/10 hover:bg-orange-700/20 hover:text-white"
                >
                  <div className="p-1 truncate">{getRelatedValue(entry)}</div>
                  <div className="p-1 truncate justify-self-center">
                    {fmt.datetime(entry.timestamp, {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                  </div>
                  <div className="p-1 flex gap-1 justify-self-center">
                    <div>{fmt.number(entry.bid)}</div>
                    <div>{fmt.number(entry.ask)}</div>
                  </div>
                  <div className="p-1 justify-self-center">
                    <Button
                      onClick={() => {
                        onDeleteEntry(entry);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-white/50 py-8">
              No entries found.
            </div>
          )}
        </div>

        {/*<footer className="flex justify-center">
          <Button
            onClick={() => {
              onDeleteSubject(subject);
            }}
          >
            Delete all
          </Button>
        </footer>*/}
      </div>
    </Modal>
  );
}

type Action =
  | { type: "import"; payload: Data }
  | { type: "add"; payload: Entry }
  | { type: "delete-item"; payload: string }
  | { type: "delete-location"; payload: string }
  | { type: "delete-entry"; payload: Entry }
  | { type: "clear" };

function reducer(data: Data, action: Action) {
  switch (action.type) {
    case "import":
      return action.payload;
    case "add":
      return immutable(data, (draft) => {
        addEntry(draft, action.payload);
        return draft;
      });
    case "delete-item":
      return immutable(data, (draft) => {
        deleteItem(draft, action.payload);
        return draft;
      });
    case "delete-location":
      return immutable(data, (draft) => {
        deleteLocation(draft, action.payload);
        return draft;
      });
    case "delete-entry":
      return immutable(data, (draft) => {
        deleteEntry(draft, action.payload);
        return draft;
      });
    case "clear":
      return createEmptyData();
    default:
      return data;
  }
}

export function App() {
  const [data, dispatch] = useReducer(reducer, null, loadStoredData);
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [fee, setFee] = useState(0.085);
  const formRef = useRef<FormHandle>(null);

  const itemHistoryModalRef = useRef<HTMLDialogElement>(null);
  const locationHistoryModalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    localStorage.setItem("data", JSON.stringify(data));
  }, [data]);

  const onEntry = (payload: Entry) => {
    dispatch({ type: "add", payload });
  };

  const handlePrefill = (
    location: string,
    item: string,
    price?: { bid: number; ask: number },
  ) => {
    if (formRef.current) {
      formRef.current.prefill({
        location,
        item,
        bid: price?.bid ?? 0,
        ask: price?.ask ?? 0,
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
        if (src.startsWith("http://") || src.startsWith("https://")) {
          fetch(src, { headers: { accept: "text/json, application/json" } })
            .then((response) => {
              if (response.ok) {
                response.text().then((nextSource) => {
                  const parsed = JSON.parse(nextSource);
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

  const openItemHistory = (item: string) => {
    setSelectedItem(item);
    itemHistoryModalRef.current?.showModal();
  };

  const openLocationHistory = (location: string) => {
    setSelectedLocation(location);
    locationHistoryModalRef.current?.showModal();
  };

  const handleFeeInput = (event: InputEvent<HTMLInputElement>) => {
    const value = parseFloat(event.currentTarget.value);
    if (!isNaN(value)) {
      setFee(value / 100);
    } else {
      setFee(0);
    }
  };

  const items = useMemo(() => {
    return [...data.items]
      .filter((item) => matchItem(query, item))
      .sort((a, b) => {
        return getNetProfit(data, b, fee) - getNetProfit(data, a, fee);
      });
  }, [data, query, fee]);

  const itemHistoryEntries = useMemo(() => {
    return data.entries
      .filter((entry) => entry.item === selectedItem)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [data.entries, selectedItem]);

  const locationHistoryEntries = useMemo(() => {
    return data.entries
      .filter((entry) => entry.location === selectedLocation)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [data.entries, selectedLocation]);

  return (
    <main className="flex flex-col gap-4 p-4 min-w-5xl h-dvh">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Market Journal</h1>

        <div className="flex gap-4">
          <Button onClick={() => handleImport()}>Import</Button>
          <Button onClick={() => handleExport()}>Export</Button>
        </div>
      </header>

      <Form
        ref={formRef}
        onSubmit={onEntry}
        lists={{ items: data.items, locations: data.locations }}
      />

      <div
        role="grid"
        className="grid overflow-auto cursor-default text-sm rounded border-2 [border-style:groove] border-stone-700"
      >
        <div
          role="row"
          className="grid grid-flow-col auto-cols-fr sticky top-0 bg-stone-500"
        >
          <div
            role="cell"
            className="flex justify-between px-2 h-9 items-center gap-1"
          >
            <div className="flex-1 flex gap-1">
              <input
                type="search"
                placeholder="Search..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="field-sizing-content placeholder-shown:flex-1 blank:flex-1 placeholder-white/50"
              />
              {query === "" ? null : (
                <button onClick={() => setQuery("")}>&times;</button>
              )}
            </div>

            <div className="flex min-w-0">
              <input
                type="number"
                value={(fee * 100).toFixed(1)}
                onInput={handleFeeInput}
                step={0.5}
                min={0}
                className="placeholder-white/50 field-sizing-content text-end min-w-2"
              />
              %
            </div>
          </div>

          {data.locations.map((location) => (
            <div
              role="cell"
              className="flex px-2 h-9 items-center justify-center hover:bg-orange-700/50 hover:text-white"
              key={location}
              onClick={() => {
                openLocationHistory(location);
              }}
            >
              {location}
            </div>
          ))}
        </div>

        {items.map((item) => (
          <div
            role="row"
            className="grid grid-flow-col auto-cols-fr odd:bg-black/10 hover:bg-white/10"
            key={item}
          >
            <div
              role="cell"
              className="px-2 h-9 flex items-center hover:bg-orange-700/50 hover:text-white"
              onClick={() => {
                openItemHistory(item);
              }}
            >
              <div className="flex items-center gap-1">
                <span className="truncate">{item}</span>

                <span
                  className={c(
                    "text-xs",
                    getNetProfit(data, item, fee) >= 0
                      ? "text-lime-400"
                      : "text-red-400",
                  )}
                >
                  {fmt.number(getNetProfit(data, item, fee), {
                    maximumFractionDigits: 0,
                    signDisplay: "always",
                  })}
                </span>
              </div>
            </div>

            {data.locations.map((location) => {
              const global = getGlobalMarket(data, item);
              const local = getLocalMarket(data, item, location);
              const gap = getMarketGap(data, item, location);

              return (
                <div
                  role="cell"
                  className="px-2 h-9 flex items-center justify-center hover:bg-orange-700/50 hover:text-white"
                  key={`${item}-${location}`}
                  onClick={() => handlePrefill(location, item, local)}
                >
                  <div className="grid grid-cols-2 gap-1 items-center">
                    <div className="justify-self-end flex gap-1 items-center">
                      <div
                        className="text-xs text-sky-400"
                        title="Premium compared to the lowest sell price across markets."
                      >
                        {gap.bid !== 0
                          ? fmt.number(gap.bid / global.min.bid, {
                              style: "percent",
                              signDisplay: "always",
                            })
                          : null}
                      </div>

                      <div title="Sell price">{fmt.number(local.bid)}</div>
                    </div>

                    <div className="flex gap-1 items-center">
                      <div title="Buy price">{fmt.number(local.ask)}</div>

                      <div
                        className="text-xs text-lime-400"
                        title="Discount compared to the highest buy price across markets."
                      >
                        {gap.ask !== 0
                          ? fmt.number(gap.ask / global.max.ask, {
                              style: "percent",
                            })
                          : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <HistoryModal
        ref={itemHistoryModalRef}
        subject={selectedItem}
        entries={itemHistoryEntries}
        getRelatedValue={(entry) => entry.location}
        onDeleteEntry={(entry) => {
          dispatch({ type: "delete-entry", payload: entry });
        }}
        onDeleteSubject={(item) => {
          dispatch({ type: "delete-item", payload: item });
        }}
      />

      <HistoryModal
        ref={locationHistoryModalRef}
        subject={selectedLocation}
        entries={locationHistoryEntries}
        getRelatedValue={(entry) => entry.item}
        onDeleteEntry={(entry) => {
          dispatch({ type: "delete-entry", payload: entry });
        }}
        onDeleteSubject={(location) => {
          dispatch({ type: "delete-location", payload: location });
        }}
      />
    </main>
  );
}
