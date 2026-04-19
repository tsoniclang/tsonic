import { IntervalAsyncIterator } from "@fixture/pkg/timers-module.js";

export function createIterator(): IntervalAsyncIterator<string> {
  return new IntervalAsyncIterator<string>();
}
