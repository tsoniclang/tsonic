import { DeepEqual } from "../../../reflect.js";
import { Sprint } from "../../../fmt.js";
export function Equal(actual, expected) {
    return () => {
        if (DeepEqual(actual, expected)) {
            return undefined;
        }
        return `not equal: ${Sprint(actual)} != ${Sprint(expected)}`;
    };
}
//# sourceMappingURL=cmp.js.map