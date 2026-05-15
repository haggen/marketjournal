import { useEffect, useReducer, useRef, type SubmitEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  addEntry,
  createEmptyData,
  deleteItem,
  deleteLocation,
  getInitialData,
  type Data,
  type Entry,
} from "@/lib/data";
import { mutated } from "@/lib/mutated";
import * as Table from "@/components/Table";
import { Input } from "@/components/Input";
import { Header } from "./components/Header";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(<App />);

type Action =
  | { type: "load"; payload: Data }
  | { type: "add"; payload: Entry }
  | { type: "delete-item"; payload: string }
  | { type: "delete-location"; payload: string }
  | { type: "clear" };

function reducer(data: Data, action: Action) {
  switch (action.type) {
    case "load":
      return action.payload;
    case "add":
      return mutated(data, (data) => {
        addEntry(data, action.payload);
      });
    case "delete-item":
      return mutated(data, (data) => {
        deleteItem(data, action.payload);
      });
    case "delete-location":
      return mutated(data, (data) => {
        deleteLocation(data, action.payload);
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

  useEffect(() => {
    localStorage.setItem("data", JSON.stringify(data));
  }, [data]);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const elements = event.currentTarget.elements;
    const location = (elements.namedItem("location") as HTMLInputElement).value;
    const item = (elements.namedItem("item") as HTMLInputElement).value;
    const price = (elements.namedItem("price") as HTMLInputElement)
      .valueAsNumber;
    const timestamp = Date.now();
    dispatch({ type: "add", payload: { location, item, price, timestamp } });
  };

  const getLargestDelta = (item: string) => {
    const locations = data.index[item]?.locations;
    if (!locations) return 0;
    return Math.max(
      0,
      ...Object.values(locations).map((l) => Math.abs(l.delta)),
    );
  };

  const sortedItems = data.items.sort((a, b) => {
    return getLargestDelta(b) - getLargestDelta(a);
  });

  const quickEdit = (entry: {
    location: string;
    item: string;
    price: number;
  }) => {
    if (formRef.current) {
      const location = formRef.current.elements.namedItem(
        "location",
      ) as HTMLInputElement;
      const item = formRef.current.elements.namedItem(
        "item",
      ) as HTMLInputElement;
      const price = formRef.current.elements.namedItem(
        "price",
      ) as HTMLInputElement;
      location.value = entry.location;
      item.value = entry.item;
      price.valueAsNumber = entry.price;
      price.select();
    }
  };

  const onExport = () => {
    navigator.clipboard.writeText(JSON.stringify(data));
  };

  const onLoad = () => {
    navigator.clipboard.readText().then((src) => {
      dispatch({ type: "load", payload: JSON.parse(src) as Data });
    });
  };

  return (
    <main className="container mx-auto flex flex-col gap-6 px-2 py-12">
      <header className="grid grid-cols-3">
        <h1 className="text-center text-3xl font-medium col-start-2">
          Market Journal
        </h1>
        <div className="flex gap-4 items-center justify-end">
          <button onClick={() => onLoad()}>Load</button>
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
            <span className="font-medium text-sm">Price:</span>
            <Input
              className="flex-1"
              type="number"
              name="price"
              required
              min="1"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-1 bg-yellow-600 border border-dashed border-olive-600 font-medium"
          >
            Save price
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
            <col />
          </colgroup>
          <thead>
            <tr>
              <th
                className="text-left px-4 py-1 bg-mist-700 border border-dashed border-mist-800"
                rowSpan={2}
              >
                Item
              </th>
              <th
                className="px-4 py-1 bg-mist-700 border border-dashed border-mist-800"
                colSpan={Math.max(1, data.locations.length)}
              >
                Price
              </th>
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
            {sortedItems.map((item) => (
              <tr key={item}>
                <Table.Header className="text-left bg-stone-600 border-stone-600">
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
                    className="text-center  bg-mist-900  border-mist-900 hover:bg-mist-900/50 hover:border-mist-900/50"
                    key={`${location}-${item}`}
                    onClick={() =>
                      quickEdit({
                        location,
                        item,
                        price:
                          data.index[item]?.locations[location]?.latest ?? 0,
                      })
                    }
                  >
                    {data.index[item]?.locations?.[location] ? (
                      <div className="inline-flex items-center gap-2">
                        {data.index[item].locations[location].latest}
                        <span
                          className={
                            "px-1 border border-dashed border-mist-900 text-xs leading-normal " +
                            (data.index[item].locations[location].delta >= 0
                              ? "bg-lime-800 text-lime-100"
                              : "bg-red-800 text-red-100")
                          }
                        >
                          {data.index[item].locations[location].delta}
                        </span>
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
