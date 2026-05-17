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
  getGlobalMarket,
  getInitialData,
  getLocalMarket,
  getMarketBuyHighlight,
  getMarketEfficiency,
  getMarketSellHighlight,
  getMarketGap,
  migrate,
  type Data,
  type Entry,
} from "@/lib/data";
import { immutable } from "@/lib/immutable";
import * as Table from "@/components/Table";
import { Input, Button } from "@/components/Form";
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
  const [submittedAt, setSubmittedAt] = useState(0);

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

    setSubmittedAt(Date.now());
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
      ask.select();
      formRef.current.scrollIntoView({ behavior: "smooth" });
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
          <button
            className="hover:text-white active:opacity-50"
            onClick={() => onImport()}
          >
            Import
          </button>
          <button
            className="hover:text-white active:opacity-50"
            onClick={() => onExport()}
          >
            Export
          </button>
        </div>
      </header>

      <form ref={formRef} onSubmit={onSubmit}>
        <fieldset className="flex gap-2 justify-center px-3 py-2 bg-olive-600 border border-dashed border-mist-800 items-end">
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Location:</span>
            <Input
              className="flex-1 border-olive-600"
              type="text"
              name="location"
              required
              list="locations"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Item:</span>
            <Input
              className="flex-1 border-olive-600"
              type="text"
              name="item"
              required
              list="items"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Buy price:</span>
            <Input
              className="flex-1 border-olive-600"
              type="number"
              name="ask"
              required
              min="1"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-sm">Sell price:</span>
            <Input
              className="flex-1 border-olive-600"
              type="number"
              name="bid"
              required
              min="1"
            />
          </label>
          <Button key={submittedAt} type="submit" className="border-olive-600">
            Save entry
          </Button>

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
                className="font-normal text-left border-mist-800 bg-mist-700"
                rowSpan={2}
              >
                <Input
                  type="search"
                  placeholder="Search item..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full border-mist-700"
                />
              </Table.Header>
              <Table.Header
                className="border-mist-800 bg-mist-700"
                colSpan={Math.max(1, data.locations.length)}
              >
                Price
              </Table.Header>
            </tr>
            <tr>
              {data.locations.map((location) => (
                <Table.Header
                  className="border-mist-800 bg-stone-600"
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
              <tr key={item} className="group hover:text-white">
                <Table.Header className="text-left border-mist-800 bg-stone-600 group-hover:bg-gray-600 ">
                  <Header
                    onDelete={() =>
                      dispatch({ type: "delete-item", payload: item })
                    }
                  >
                    {item}
                  </Header>
                </Table.Header>
                {data.locations.map((location) => {
                  const global = getGlobalMarket(data, item);
                  const local = getLocalMarket(data, item, location);
                  const spread = getMarketGap(data, item, location);

                  return (
                    <Table.Cell
                      className="text-center border-mist-800 bg-mist-900 group-hover:bg-gray-600/30 hover:bg-gray-600/60 "
                      key={`${location}-${item}`}
                      onClick={() =>
                        quickEdit({
                          location,
                          item,
                          price: local?.latest,
                        })
                      }
                    >
                      {local.latest.ask > 0 ? (
                        <div className="inline-flex items-center gap-2">
                          {spread.ask > 0 ? (
                            <span
                              className="px-1 bg-clip-padding border border-dashed border-lime-700 bg-lime-700 text-lime-100 text-xs leading-normal rounded"
                              title="Discount compared to the highest buy price."
                            >
                              {fmt.number(
                                (spread.ask / local.latest.ask) * -1,
                                {
                                  style: "percent",
                                },
                              )}
                            </span>
                          ) : null}

                          <span className="text-xs text-mist-400">Buy</span>
                          {fmt.number(local.latest.ask)}

                          <span className="text-xs text-mist-400">Sell</span>
                          {fmt.number(local.latest.bid)}

                          {spread.bid > 0 ? (
                            <span
                              className="px-1 bg-clip-padding border border-dashed border-sky-700 bg-sky-700 text-blue-100 text-xs leading-normal rounded"
                              title="Premium compared to the lowest sell price."
                            >
                              +
                              {fmt.number(spread.bid / local.latest.bid, {
                                style: "percent",
                              })}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        "-"
                      )}
                    </Table.Cell>
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
