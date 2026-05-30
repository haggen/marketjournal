import { extendTailwindMerge } from "tailwind-merge";

export const c = extendTailwindMerge<"tear-off">({
  extend: {
    classGroups: {
      "tear-off": [{ "tear-off": [() => true] }],
    },
  },
});
