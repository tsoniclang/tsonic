import { int } from "@tsonic/core/types.js";

export class Utils {
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
