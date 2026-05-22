import {
  getLocalMarket,
  getMarketGap,
  type Data,
  type Price,
} from "@/lib/data";
import { fmt } from "@/lib/fmt";

export function Price({
  className,
  data,
  item,
  location,
  onPrefill,
}: {
  className?: string;
  data: Data;
  item: string;
  location: string;
  onPrefill: (location: string, item: string, price: Price) => void;
}) {
  const local = getLocalMarket(data, item, location);
  const gap = getMarketGap(data, item, location);

  const content = (
    <div className="grid grid-cols-2 gap-2 items-center">
      <div className="flex gap-2 items-center justify-self-end">
        <div
          className="text-xs text-red-400"
          title="Premium compared to the lowest sell price across markets."
        >
          {gap.bid > 0
            ? "+" +
              fmt.number(gap.bid / local.latest.bid, {
                style: "percent",
              })
            : null}
        </div>

        <div title="Sell price">{fmt.number(local.latest.bid)}</div>
      </div>

      <div className="flex items-center gap-2">
        <div title="Buy price">{fmt.number(local.latest.ask)}</div>

        <div
          className="text-xs text-lime-400"
          title="Discount compared to the highest buy price across markets."
        >
          {gap.ask > 0
            ? fmt.number((gap.ask / local.latest.ask) * -1, {
                style: "percent",
              })
            : null}
        </div>
      </div>
    </div>
  );

  return (
    <td
      className={className}
      key={`${location}-${item}`}
      onClick={() => onPrefill(location, item, local?.latest)}
    >
      {local.latest.ask > 0 ? content : "-"}
    </td>
  );
}
