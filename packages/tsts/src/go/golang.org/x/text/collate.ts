import type { int } from "../../../scalars.js";
import type { Tag } from "./language.js";

export type Option = (options: Intl.CollatorOptions) => void;

export const IgnoreCase: Option = (options) => {
  options.sensitivity = "base";
};

export const Loose: Option = (options) => {
  options.usage = "search";
};

export const Numeric: Option = (options) => {
  options.numeric = true;
};

export class Collator {
  private readonly collator: Intl.Collator;

  constructor(tag: Tag, options: Intl.CollatorOptions) {
    this.collator = new Intl.Collator(tag === "" ? undefined : tag, options);
  }

  CompareString(left: string, right: string): int {
    return this.collator.compare(left, right) as int;
  }
}

export function New(tag: Tag, ...options: Array<Option>): Collator {
  const collatorOptions: Intl.CollatorOptions = {};
  for (const option of options) {
    option(collatorOptions);
  }
  return new Collator(tag, collatorOptions);
}
