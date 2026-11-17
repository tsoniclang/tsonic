export const optionalIndexedLocationSource = `
import { addressof, equalptr, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { int32, int64 } from "@tsonic/core/types.js";
class Value { text = "before"; }
export function run(): boolean {
  const texts: (string | null | undefined)[] = ["before"];
  let index: int32 = 0;
  const textLocation = addressof<string | null | undefined>(texts[index++]);
  const addressedOnce = index === 1 && equalptr(textLocation, addressof<string | null | undefined>(texts[0]));
  storeptr(textLocation, undefined);
  const textAbsent = texts[0] === null && loadptr(textLocation) === undefined;
  storeptr(textLocation, "after");
  const textPresent = texts[0] === "after" && loadptr(textLocation) === "after";
  storeptr(textLocation, null);
  const textNull = texts[0] === undefined;
  const numbers: (int64 | undefined)[] = [9007199254740993n];
  const numberLocation = addressof<int64 | undefined>(numbers[0]);
  const numberInitial = loadptr(numberLocation) === 9007199254740993n;
  storeptr(numberLocation, undefined);
  const numberAbsent = numbers[0] === null;
  storeptr(numberLocation, 9007199254740995n);
  const numberPresent = numbers[0] === 9007199254740995n;
  const value = new Value();
  const values: (Value | undefined)[] = [value];
  const location = addressof<Value | undefined>(values[0]);
  value.text = "after";
  const valueInitial = loadptr(location)?.text === "after" && loadptr(location) === value;
  storeptr(location, undefined);
  const valueAbsent = values[0] === undefined && loadptr(location) === null;
  storeptr(location, value);
  return addressedOnce && textAbsent && textPresent && textNull && numberInitial && numberAbsent && numberPresent &&
    valueInitial && valueAbsent && values[0] === value && values[0]?.text === "after";
}
`;
