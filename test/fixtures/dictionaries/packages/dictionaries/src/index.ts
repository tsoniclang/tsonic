import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Dictionary with string keys
function createStringDict(): Record<string, number> {
  const dict: Record<string, number> = {};
  dict["one"] = 1;
  dict["two"] = 2;
  dict["three"] = 3;
  return dict;
}

// Dictionary with number keys
function createNumberDict(): Record<number, string> {
  const dict: Record<number, string> = {};
  dict[1] = "one";
  dict[2] = "two";
  dict[3] = "three";
  return dict;
}

// Pure index-signature interfaces/type aliases should behave as dictionaries.
interface IntTotals {
  [metric: string]: int;
}

type IntTotalsAlias = { [metric: string]: int };

const strDict = createStringDict();
const numDict = createNumberDict();

function sumStringDict(dict: Record<string, number> | undefined): number {
  let sum = 0.0;
  if (dict) {
    for (const k in dict) {
      sum += dict[k];
    }
  }
  return sum;
}

function sumIntDict(dict: Record<string, int> | undefined): int {
  let sum: int = 0;
  if (dict) {
    for (const k in dict) {
      sum += dict[k];
    }
  }
  return sum;
}

const intDict: Record<string, int> = {};
intDict["a"] = 10;
intDict["b"] = 20;

const totals: IntTotals = {};
totals["pageviews"] = 123;

const totalsAlias: IntTotalsAlias = {};
totalsAlias["sessions"] = 7;

Console.WriteLine(`String dict 'one': ${strDict["one"]}`);
Console.WriteLine(`String dict 'two': ${strDict["two"]}`);
Console.WriteLine(`Number dict 1: ${numDict[1]}`);
Console.WriteLine(`Number dict 2: ${numDict[2]}`);
Console.WriteLine(`String dict sum: ${sumStringDict(strDict)}`);
Console.WriteLine(`Int dict sum: ${sumIntDict(intDict)}`);
Console.WriteLine(`Index sig interface total: ${totals["pageviews"]}`);
Console.WriteLine(`Index sig type alias total: ${totalsAlias["sessions"]}`);
