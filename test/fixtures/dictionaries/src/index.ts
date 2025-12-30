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

Console.writeLine(`String dict 'one': ${strDict["one"]}`);
Console.writeLine(`String dict 'two': ${strDict["two"]}`);
Console.writeLine(`Number dict 1: ${numDict[1]}`);
Console.writeLine(`Number dict 2: ${numDict[2]}`);
