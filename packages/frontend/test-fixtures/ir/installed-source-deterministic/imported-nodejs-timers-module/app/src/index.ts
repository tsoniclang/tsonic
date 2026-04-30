import { IntervalAsyncIterator } from "@tsonic/nodejs/timers.js";

export function createIterator(): IntervalAsyncIterator<string> {
  return new IntervalAsyncIterator<string>(1);
}
