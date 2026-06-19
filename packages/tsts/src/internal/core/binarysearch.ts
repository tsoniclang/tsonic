import type { bool, int } from "../../go/scalars.js";
import type { GoConstraint, GoSlice } from "../../go/compat.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/binarysearch.go::func::BinarySearchUniqueFunc","kind":"func","status":"implemented","sigHash":"eb9aa8d5ae45b66b6740ea5a604ff6184345506ebd0c4f35d9d51c339045e8f6","bodyHash":"6551b934ed24c11e0cd49d524a7771d895f2f69a3bbcb812b8afa3f69a536667"}
 *
 * Go source:
 * func BinarySearchUniqueFunc[S ~[]E, E any](x S, cmp func(int, E) int) (int, bool) {
 * 	n := len(x)
 * 	if n == 0 {
 * 		return 0, false
 * 	}
 * 	low, high := 0, n-1
 * 	for low <= high {
 * 		middle := low + ((high - low) >> 1)
 * 		value := cmp(middle, x[middle])
 * 		if value < 0 {
 * 			low = middle + 1
 * 		} else if value > 0 {
 * 			high = middle - 1
 * 		} else {
 * 			return middle, true
 * 		}
 * 	}
 * 	return low, false
 * }
 */
export function BinarySearchUniqueFunc<S extends GoConstraint<"~[]E"> & GoSlice<E>, E>(x: S, cmp: (arg0: int, arg1: E) => int): [int, bool] {
  const n = x.length as int;
  if (n === 0) {
    return [0 as int, false];
  }
  let low = 0 as int;
  let high = (n - 1) as int;
  while (low <= high) {
    const middle = (low + ((high - low) >> 1)) as int;
    const value = cmp(middle, x[middle]!);
    if (value < 0) {
      low = (middle + 1) as int;
    } else if (value > 0) {
      high = (middle - 1) as int;
    } else {
      return [middle, true];
    }
  }
  return [low, false];
}
