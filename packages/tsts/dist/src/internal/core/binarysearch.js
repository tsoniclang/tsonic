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
export function BinarySearchUniqueFunc(x, cmp) {
    const n = x.length;
    if (n === 0) {
        return [0, false];
    }
    let low = 0;
    let high = (n - 1);
    while (low <= high) {
        const middle = (low + ((high - low) >> 1));
        const value = cmp(middle, x[middle]);
        if (value < 0) {
            low = (middle + 1);
        }
        else if (value > 0) {
            high = (middle - 1);
        }
        else {
            return [middle, true];
        }
    }
    return [low, false];
}
//# sourceMappingURL=binarysearch.js.map