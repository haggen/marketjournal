import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { DeleteIcon, DollarSignIcon, XIcon } from "lucide-react";
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
          const latestA = getLocalMarket(data, a, sortKey[1]).latest[
            sortKey[0]
          ];
          const latestB = getLocalMarket(data, b, sortKey[1]).latest[
            sortKey[0]
          ];

          if (latestA === 0 && latestB !== 0) {
            return 1;
          }

          if (latestB === 0 && latestA !== 0) {
            return -1;
          }

          return (latestB - latestA) * (sortKey[0] === "ask" ? -1 : 1);
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
    <main className="mx-auto flex flex-col gap-4 px-4 py-8">
      <header className="grid grid-cols-3">
        <h1 className="col-start-2 text-center text-3xl font-medium">
          Market Journal
        </h1>

        <div className="flex gap-6 items-center justify-end">
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

      <hr className="h-1 tear-off-mist-700" />

      <div className="-m-2">
        <table className="table-fixed border-separate w-full border-spacing-2 cursor-default">
          <colgroup>
            <col />
            <col className="w-24" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className="px-2 font-normal tear-off-gray-500">
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    placeholder="Search..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 text-sm placeholder:text-gray-400 focus-within:outline-none"
                  />
                  {query !== "" ? (
                    <button onClick={() => setQuery("")}>
                      <DeleteIcon strokeWidth={3} size={12} />
                    </button>
                  ) : null}
                </div>
              </th>

              <th className="px-2 tear-off-stone-500">
                <DollarSignIcon strokeWidth={3} size={12} className="mx-auto" />
              </th>
              {data.locations.map((location) => (
                <th className="px-2 tear-off-stone-500 group" key={location}>
                  <Header
                    justify="center"
                    trailing={
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "delete-location",
                            payload: location,
                          })
                        }
                      >
                        <XIcon strokeWidth={4} size={12} />
                      </button>
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
              <tr key={item} className="group hover:text-white">
                <th className="px-2 text-left group tear-off-stone-500 group-hover:tear-off-mauve-500">
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
                <td className="text-center tear-off-mist-900 group-hover:tear-off-mauve-700 hover:tear-off-mauve-700">
                  {getMarketSpread(data, item)}
                </td>
                {data.locations.map((location) => (
                  <Price
                    className="text-center tear-off-mist-900 group-hover:tear-off-mauve-700 hover:tear-off-mauve-700"
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
