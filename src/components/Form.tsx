import {
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type SubmitEvent,
} from "react";
import { twMerge } from "tailwind-merge";
import z from "zod";
import { type Entry, matchItem } from "@/lib/data";
import { getFormElement, setFormValue } from "@/lib/form";
import { Autocomplete } from "./Autocomplete";
import { styles } from "../lib/styles";

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

    onSubmit(payload);

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
            filter={(query, item) => matchItem(query, item)}
            data={lists.items}
          />
        </label>

        <label className="flex-1 flex flex-col gap-1">
          <span className="font-medium text-sm">
            Sell price (highest buy order):
          </span>
          <input
            className={twMerge(styles.input, "flex-1 border-olive-600")}
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
