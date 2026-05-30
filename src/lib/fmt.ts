function number(number: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, options).format(number);
}

function datetime(value: Date | number, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(
    typeof value === "number" ? new Date(value) : value,
  );
}

export const fmt = {
  number,
  datetime,
};
