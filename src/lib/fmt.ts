function number(number: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, options).format(number);
}

export const fmt = {
  number,
};
