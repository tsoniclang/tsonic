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
  const num = Utils.identity(42);
  Console.writeLine(`Identity int: ${num}`);

  const str = Utils.identity("hello");
  Console.writeLine(`Identity string: ${str}`);

  // Instance calls
  const utils = new Utils();
  const wrapped = utils.wrap(100);
  Console.writeLine(`Wrapped: ${wrapped.value}`);

  const p = utils.pair("count", 5);
  Console.writeLine(`Pair: ${p.key}=${p.value}`);
}
