import {
  useImperativeHandle,
  useRef,
  useState,
  type FocusEvent,
  type Ref,
  type SubmitEvent,
} from "react";
import z from "zod";
import { type Entry, matchItem } from "@/lib/data";
import { getFormElement, setFormValue } from "@/lib/form";
import { Autocomplete } from "@/components/Autocomplete";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Input } from "@/components/Input";

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
          setFormValue(formRef.current, "bid", entry.bid.toString());
          setFormValue(formRef.current, "ask", entry.ask.toString());

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

    const entry = {
      timestamp: Date.now(),
      location: z.string().min(1).parse(data.get("location")),
      item: z.string().min(1).parse(data.get("item")),
      bid: z.coerce.number().min(1).parse(data.get("bid")),
      ask: z.coerce.number().min(1).parse(data.get("ask")),
    };

    onSubmit(entry);

    setFormValue(event.currentTarget, "item", "");
    setFormValue(event.currentTarget, "bid", "");
    setFormValue(event.currentTarget, "ask", "");

    getFormElement(event.currentTarget, "item").focus();

    setSubmittedAt(Date.now());
  };

  const handleAskFocus = (event: FocusEvent<HTMLInputElement>) => {
    if (event.currentTarget.value === "" && formRef.current) {
      event.currentTarget.value = getFormElement(formRef.current, "bid").value;
      event.currentTarget.select();
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex p-2 gap-2 scroll-p-4 bg-stone-500 rounded-xs hard-shadow"
    >
      <Autocomplete.Root data={lists.locations}>
        <Field label="Market location" className="flex-1">
          {({ id }) => (
            <Autocomplete.Input
              id={id}
              type="text"
              name="location"
              required
              autoComplete="off"
              placeholder="Thetford"
            />
          )}
        </Field>

        <Autocomplete.List />
      </Autocomplete.Root>

      <Autocomplete.Root data={lists.items} filter={matchItem}>
        <Field label="Item name" className="flex-1">
          {({ id }) => (
            <Autocomplete.Input
              id={id}
              type="text"
              name="item"
              required
              autoComplete="off"
              placeholder="Travertine"
            />
          )}
        </Field>

        <Autocomplete.List />
      </Autocomplete.Root>

      <Field label="Sell price (highest buy order)" className="flex-1">
        {({ id }) => <Input id={id} type="number" name="bid" min="1" required placeholder="99" />}
      </Field>

      <Field label="Buy price (lowest sell order)" className="flex-1">
        {({ id }) => (
          <Input
            id={id}
            type="number"
            name="ask"
            min="1"
            required
            onFocus={handleAskFocus}
            placeholder="101"
          />
        )}
      </Field>

      <footer className="flex items-end">
        <Button key={submittedAt} type="submit" variant="primary">
          Save entry
        </Button>
      </footer>
    </form>
  );
}
