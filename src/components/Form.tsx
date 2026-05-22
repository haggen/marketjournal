import {
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type SubmitEvent,
} from "react";
import z from "zod";
import { type Entry, matchItem } from "@/lib/data";
import { getFormElement, setFormValue } from "@/lib/form";
import { Autocomplete } from "./Autocomplete";

export type FormHandle = {
  prefill(entry: Omit<Entry, "timestamp">): void;
};

export function Form({
  ref,
  onSubmit,
  lists,
}: {
  ref: Ref<FormHandle>;
  onSubmit: (entry: Entry) => void;
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

          getFormElement(formRef.current, "bid").select();

          formRef.current.scrollIntoView();
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

    onSubmit(payload);

    setFormValue(event.currentTarget, "item", "");
    setFormValue(event.currentTarget, "bid", "");
    setFormValue(event.currentTarget, "ask", "");

    getFormElement(event.currentTarget, "item").focus();

    setSubmittedAt(Date.now());
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="scroll-m-2">
      <fieldset className="flex gap-2 justify-center p-2 rounded tear-off-olive-500 items-end">
        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">Market location:</span>
          <Autocomplete
            className="flex-1 p-1 text-white rounded tear-off-black/30 focus-within:tear-off-black/60 focus-within:outline-none"
            type="text"
            name="location"
            required
            data={lists.locations}
            autoComplete="off"
          />
        </label>

        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">Item name:</span>
          <Autocomplete
            className="flex-1 p-1 text-white rounded tear-off-black/30 focus-within:tear-off-black/60 focus-within:outline-none"
            type="text"
            name="item"
            required
            filter={(query, item) => matchItem(query, item)}
            data={lists.items}
            autoComplete="off"
          />
        </label>

        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">
            Sell price (highest buy order):
          </span>
          <input
            className="flex-1 p-1 text-white rounded tear-off-black/30 focus-within:tear-off-black/60 focus-within:outline-none"
            type="number"
            name="bid"
            required
            min="1"
          />
        </label>

        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">
            Buy price (lowest sell order):
          </span>
          <input
            className="flex-1 p-1 text-white rounded tear-off-black/30 focus-within:tear-off-black/60 focus-within:outline-none"
            type="number"
            name="ask"
            required
            min="1"
          />
        </label>

        <button
          key={submittedAt}
          type="submit"
          className="px-6 py-1 font-bold font-sm rounded tear-off-yellow-500 hover:tear-off-yellow-400 hover:text-white active:opacity-50 animate-blink"
        >
          Save entry
        </button>
      </fieldset>
    </form>
  );
}
