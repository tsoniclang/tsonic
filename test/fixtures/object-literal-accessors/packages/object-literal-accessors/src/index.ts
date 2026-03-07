import { Console } from "@tsonic/dotnet/System.js";

const counter = {
  _value: 1,
  get value(): number {
    return this._value;
  },
  set value(v: number) {
    this._value = v;
  },
};

counter.value = counter.value + 4;
Console.WriteLine(counter.value);
