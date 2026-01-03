import { int } from "@tsonic/core/types.js";

export interface Wrapper<T> {
  value: T;
}

export interface Pair<K, V> {
  key: K;
  value: V;
}

export class Utils {
  // Static generic method
  static identity<T>(value: T): T {
    return value;
  }

  // Instance generic method
  wrap<T>(value: T): Wrapper<T> {
    return { value };
  }

  // Generic method with multiple params
  pair<K, V>(key: K, value: V): Pair<K, V> {
    return { key, value };
  }
}
