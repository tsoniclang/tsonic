import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

class Utils {
  // Static generic method
  static identity<T>(value: T): T {
    return value;
  }

  // Instance generic method
  wrap<T>(value: T): { value: T } {
    return { value };
  }

  // Generic method with multiple params
  pair<K, V>(key: K, value: V): { key: K; value: V } {
    return { key, value };
  }
}

export function main(): void {
  // Static calls
  const num = Utils.identity<int>(42 as int);
  Console.writeLine(`Identity int: ${num}`);

  const str = Utils.identity<string>("hello");
  Console.writeLine(`Identity string: ${str}`);

  // Instance calls
  const utils = new Utils();
  const wrapped = utils.wrap<int>(100 as int);
  Console.writeLine(`Wrapped: ${wrapped.value}`);

  const p = utils.pair<string, int>("count", 5 as int);
  Console.writeLine(`Pair: ${p.key}=${p.value}`);
}
