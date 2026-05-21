import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CircleXIcon, SortDescIcon, XIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";
import {
  addEntry,
  createEmptyData,
  deleteItem,
  deleteLocation,
  getInitialData,
  getLocalMarket,
  getMarketSpread,
  matchItem,
  migrate,
  type Data,
  type Entry,
} from "@/lib/data";
import { immutable } from "@/lib/immutable";
import { Form, type FormHandle } from "@/components/Form";
import { Header } from "@/components/Header";
import { styles } from "@/lib/styles";
import { Price } from "./Price";

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
    case "clear":
      return createEmptyData();
    default:
      return data;
  }
}

export function App() {
  const [data, dispatch] = useReducer(reducer, null, getInitialData);
  const formRef = useRef<FormHandle>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<["spread"] | ["bid" | "ask", string]>([
    "spread",
  ]);

  useEffect(() => {
    localStorage.setItem("data", JSON.stringify(data));
  }, [data]);

  const onEntry = (payload: Entry) => {
    dispatch({ type: "add", payload });
  };

  const items = useMemo(() => {
    return [...data.items]
      .filter((item) => matchItem(query, item))
      .sort((a, b) => {
        if (sortKey.length === 2) {
          return (
            (getLocalMarket(data, b, sortKey[1]).latest[sortKey[0]] -
              getLocalMarket(data, a, sortKey[1]).latest[sortKey[0]]) *
            (sortKey[0] === "ask" ? -1 : 1)
          );
        }

        return getMarketSpread(data, b) - getMarketSpread(data, a);
      });
  }, [data, query, sortKey]);

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

  const handleSort = (key: string) => {
    if (key === "spread") {
      setSortKey([key]);
    } else {
      setSortKey([
        sortKey[1] === key && sortKey[0] === "ask" ? "bid" : "ask",
        key,
      ]);
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
        onSubmit={onEntry}
        lists={{ items: data.items, locations: data.locations }}
      />

      <hr className="h-1 border border-mist-800 bg-mist-600 border-dashed" />

      <div className="-m-2">
        <table className="table-fixed border-separate w-full border-spacing-2">
          <col />
          <col className="w-28" />
          <col />
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
                colSpan={Math.max(1, data.locations.length) + 1}
              >
                Markets
              </th>
            </tr>
            <tr>
              <th
                className={twMerge(
                  styles.th,
                  "border-mist-800 bg-stone-600 group",
                )}
              >
                <Header
                  justify="center"
                  trailing={
                    <button
                      key={1}
                      type="button"
                      onClick={() => handleSort("spread")}
                    >
                      <SortDescIcon strokeWidth={2} size={12} />
                    </button>
                  }
                >
                  Spread
                </Header>
              </th>
              {data.locations.map((location) => (
                <th
                  className={twMerge(
                    styles.th,
                    "border-mist-800 bg-stone-600 group",
                  )}
                  key={location}
                >
                  <Header
                    justify="center"
                    trailing={[
                      <button
                        key={0}
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "delete-location",
                            payload: location,
                          })
                        }
                      >
                        <XIcon strokeWidth={4} size={12} />
                      </button>,
                      <button
                        key={1}
                        type="button"
                        className={
                          sortKey[1] === location
                            ? sortKey[0] === "bid"
                              ? "text-red-500"
                              : "text-lime-500"
                            : ""
                        }
                        onClick={() => handleSort(location)}
                      >
                        <SortDescIcon strokeWidth={2} size={12} />
                      </button>,
                    ]}
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
                    "text-left group border-mist-800 bg-stone-600 group-hover/row:bg-gray-600",
                  )}
                >
                  <Header
                    justify="start"
                    trailing={
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: "delete-item", payload: item })
                        }
                      >
                        <XIcon strokeWidth={4} size={12} />
                      </button>
                    }
                  >
                    {item}
                  </Header>
                </th>
                <td
                  className={twMerge(
                    styles.td,
                    "text-center border-mist-800 bg-mist-900 group-hover/row:bg-gray-600/30 hover:bg-gray-600/60",
                  )}
                >
                  {getMarketSpread(data, item)}
                </td>
                {data.locations.map((location) => (
                  <Price
                    key={`${item}-${location}`}
                    data={data}
                    item={item}
                    location={location}
                    onPrefill={handlePrefill}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
