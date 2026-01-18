import { Console } from "@tsonic/dotnet/System.js";

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

const strDict = createStringDict();
const numDict = createNumberDict();

Console.WriteLine(`String dict 'one': ${strDict["one"]}`);
Console.WriteLine(`String dict 'two': ${strDict["two"]}`);
Console.WriteLine(`Number dict 1: ${numDict[1]}`);
Console.WriteLine(`Number dict 2: ${numDict[2]}`);
