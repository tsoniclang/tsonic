import { Console } from "@tsonic/dotnet/System.js";

const valueKey = "value";
const doubledKey = "doubled";
const scaleKey = "scale";

const obj = {
  [valueKey]: 21,
  get [doubledKey](): number {
    return this.value * 2;
  },
  [scaleKey](factor: number): number {
    return this.value * factor;
  },
};

Console.WriteLine(obj.doubled.ToString() + ":" + obj.scale(2).ToString());
