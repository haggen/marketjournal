import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useMemo,
  type SubmitEvent,
} from "react";
import { createRoot } from "react-dom/client";
import {
  addEntry,
  createEmptyData,
  deleteItem,
  deleteLocation,
  getInitialData,
  getLocalMarket,
  getMarketSpread,
  migrate,
  type Data,
  type Entry,
} from "@/lib/data";
import { immutable } from "@/lib/immutable";
import * as Table from "@/components/Table";
import { Input } from "@/components/Input";
import { Header } from "@/components/Header";
import { fmt } from "@/lib/fmt";
import z from "zod";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(<App />);

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
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    localStorage.setItem("data", JSON.stringify(data));
  }, [data]);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
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

    dispatch({ type: "add", payload });
  };

  const items = useMemo(() => {
    return [...data.items].filter((item) =>
      item.toLowerCase().includes(query.toLowerCase()),
    );
  }, [data, query]);

  const quickEdit = (entry: {
    item: string;
    location: string;
    price?: { ask: number; bid: number };
  }) => {
    if (formRef.current) {
      const location = formRef.current.elements.namedItem(
        "location",
      ) as HTMLInputElement;
      const item = formRef.current.elements.namedItem(
        "item",
      ) as HTMLInputElement;
      const bid = formRef.current.elements.namedItem("bid") as HTMLInputElement;
      const ask = formRef.current.elements.namedItem("ask") as HTMLInputElement;
      location.value = entry.location;
      item.value = entry.item;
      bid.value = String(entry.price?.bid ?? "");
      ask.value = String(entry.price?.ask ?? "");
      bid.select();
    }
  };

  const onExport = () => {
    navigator.clipboard.writeText(JSON.stringify(data));
  };

  const onImport = () => {
    navigator.clipboard.readText().then((src) => {
      const parsed = JSON.parse(src);
      migrate(parsed);
      dispatch({ type: "import", payload: parsed as Data });
    });
  };

  return (
    <main className="container mx-auto flex flex-col gap-6 px-2 py-12">
      <header className="grid grid-cols-3">
        <h1 className="text-center text-3xl font-medium col-start-2">
          Market Journal
        </h1>
        <div className="flex gap-4 items-center justify-end">
          <button onClick={() => onImport()}>Import</button>
          <button onClick={() => onExport()}>Export</button>
        </div>
      </header>

      <form ref={formRef} onSubmit={onSubmit}>
        <fieldset className="flex gap-2 justify-center p-3 bg-olive-600 border border-dashed border-mist-800 items-end">
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Location:</span>
            <Input
              className="flex-1"
              type="text"
              name="location"
              required
              list="locations"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Item:</span>
            <Input
              className="flex-1"
              type="text"
              name="item"
              required
              list="items"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Market bid:</span>
            <Input
              className="flex-1"
              type="number"
              name="bid"
              required
              min="1"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Market ask:</span>
            <Input
              className="flex-1"
              type="number"
              name="ask"
              required
              min="1"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-1 bg-yellow-600 border border-dashed border-yellow-600 bg-clip-padding font-medium hover:bg-amber-400 hover:border-amber-400"
          >
            Save entry
          </button>

          <datalist id="locations">
            {data.locations.map((location) => (
              <option key={location} value={location} />
            ))}
          </datalist>

          <datalist id="items">
            {data.items.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </fieldset>
      </form>

      <hr className="h-1 border border-mist-800 bg-mist-600 border-dashed" />

      <div className="-m-2">
        <table className="table-fixed border-separate w-full border-spacing-2">
          <colgroup>
            <col className="group/col" />
          </colgroup>
          <thead>
            <tr>
              <Table.Header
                className="text-left bg-mist-700 border-mist-700"
                rowSpan={2}
              >
                <input
                  type="search"
                  placeholder="Everything"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="bg-transparent border-none outline-none w-full p-0 m-0 font-inherit text-inherit placeholder-inherit focus:ring-0"
                />
              </Table.Header>
              <Table.Header
                className="bg-mist-700 border-mist-700"
                colSpan={Math.max(1, data.locations.length)}
              >
                Price
              </Table.Header>
            </tr>
            <tr>
              {data.locations.map((location) => (
                <Table.Header
                  className="bg-stone-600 border-stone-600"
                  key={location}
                >
                  <Header
                    onDelete={() =>
                      dispatch({ type: "delete-location", payload: location })
                    }
                  >
                    {location}
                  </Header>
                </Table.Header>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item} className="group">
                <Table.Header className="text-left bg-stone-600 border-stone-600 group-hover:bg-mauve-600 group-hover:border-mauve-600">
                  <Header
                    onDelete={() =>
                      dispatch({ type: "delete-item", payload: item })
                    }
                  >
                    {item}
                  </Header>
                </Table.Header>
                {data.locations.map((location) => (
                  <Table.Cell
                    className="text-center bg-mist-900 border-mist-900 group-hover:bg-mauve-900/60 group-hover:border-mauve-900/60 hover:bg-mauve-900 hover:border-mauve-900"
                    key={`${location}-${item}`}
                    onClick={() =>
                      quickEdit({
                        location,
                        item,
                        price: getLocalMarket(data, item, location)?.latest,
                      })
                    }
                  >
                    {getLocalMarket(data, item, location) ? (
                      <div className="inline-flex items-center gap-2">
                        <span className="text-xs text-mist-400">Ask</span>
                        {fmt.number(
                          getLocalMarket(data, item, location)!.latest.ask,
                        )}
                        {/*<span className="px-1 border border-dashed border-lime-800 bg-clip-padding text-xs leading-normal bg-lime-800 text-lime-100">
                          +
                          {fmt.number(
                            getMarketSpread(data, item, location)!.ask,
                          )}
                        </span>*/}
                        <span className="text-xs text-mist-400">Bid</span>
                        {fmt.number(
                          getLocalMarket(data, item, location)!.latest.bid,
                        )}
                        {/*<span className="px-1 border border-dashed border-lime-800 bg-clip-padding text-xs leading-normal bg-lime-800 text-lime-100">
                          +
                          {fmt.number(
                            getMarketSpread(data, item, location)!.bid,
                          )}
                        </span>*/}
                      </div>
                    ) : (
                      "-"
                    )}
                  </Table.Cell>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
