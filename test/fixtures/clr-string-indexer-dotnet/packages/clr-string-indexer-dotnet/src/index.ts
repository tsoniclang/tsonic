import { Console } from "@tsonic/dotnet/System.js";
import { StringDictionary } from "@tsonic/dotnet/System.Collections.Specialized.js";

export function main(): void {
  const dict = new StringDictionary();
  dict.Add("from", "abc");

  const v = dict["from"]!;
  Console.WriteLine(`V=${v}`);
  Console.WriteLine(`LEN=${v.Length}`);
}
