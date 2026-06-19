import type { bool } from "../../../scalars.js";
import { DeepEqual } from "../../../reflect.js";
import { Sprint } from "../../../fmt.js";

export function Equal(actual: unknown, expected: unknown): () => string | undefined | bool {
  return (): string | undefined => {
    if (DeepEqual(actual, expected)) {
      return undefined;
    }
    return `not equal: ${Sprint(actual)} != ${Sprint(expected)}`;
  };
}
