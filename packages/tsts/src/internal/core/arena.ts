import type { int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/arena.go::type::Arena","kind":"type","status":"implemented","sigHash":"866dd69ab11aaa9aeee1c0e91b8a7af12f59ff5857f9a4e17d1779c0c3f973c2","bodyHash":"38f2190ab841cbf54c059e3dedb3a5a315a1cd4bc80b3c78ed2d38b4c0300932"}
 *
 * Go source:
 * Arena[T any] struct {
 * 	data []T
 * }
 */
export interface Arena<T = unknown> {
  data: GoSlice<T>;
}

function ensureArena<T>(receiver: GoPtr<Arena<T>>): Arena<T> {
  const arena = receiver ?? ({ data: [] } as Arena<T>);
  arena.data ??= [];
  return arena;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/arena.go::method::Arena.New","kind":"method","status":"implemented","sigHash":"7f61e2bb57de57610e5585534f7544ee42ef4fef68509f3a42c767cf9152e756","bodyHash":"b9bd82671cbff82c70555631173bc5f846f2b81fd84ef711e37082b735d1f20f"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Go arenas retain allocated values because returned pointers refer into a backing slice; JS object references are already stable and GC-tracked, so retaining each value again through Arena.data is duplicate work."}
 *
 * Go source:
 * func (a *Arena[T]) New() *T {
 * 	if len(a.data) == cap(a.data) {
 * 		nextSize := nextArenaSize(len(a.data))
 * 		// Use the same trick as slices.Concat; Grow rounds up to the next size class.
 * 		a.data = slices.Grow[[]T](nil, nextSize)
 * 	}
 * 	index := len(a.data)
 * 	a.data = a.data[:index+1]
 * 	return &a.data[index]
 * }
 */
export function Arena_New<T>(receiver: GoPtr<Arena<T>>): GoPtr<T> {
  ensureArena(receiver);
  return {} as T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/arena.go::method::Arena.NewSlice","kind":"method","status":"implemented","sigHash":"e6e68464be11603146e0ba334fce4d5628033c5389e68c2032220be0b3bef2c3","bodyHash":"607827fa585765652039cf140ef55b5973bd0297db32e1930d30c8e8964be471"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Go arenas retain backing storage for returned slices; JS arrays are heap objects with stable references, so TSTS returns the requested zero-value slice directly and avoids duplicate Arena.data retention."}
 *
 * Go source:
 * func (a *Arena[T]) NewSlice(size int) []T {
 * 	if size == 0 {
 * 		return nil
 * 	}
 * 	if len(a.data)+size > cap(a.data) {
 * 		nextSize := nextArenaSize(len(a.data))
 * 		if size > nextSize {
 * 			return make([]T, size)
 * 		}
 * 		// Use the same trick as slices.Concat; Grow rounds up to the next size class.
 * 		a.data = slices.Grow[[]T](nil, nextSize)
 * 	}
 * 	newLen := len(a.data) + size
 * 	slice := a.data[len(a.data):newLen:newLen]
 * 	a.data = a.data[:newLen]
 * 	return slice
 * }
 */
export function Arena_NewSlice<T>(receiver: GoPtr<Arena<T>>, size: int): GoSlice<T> {
  if (size === 0) {
    return [];
  }
  ensureArena(receiver);
  return new globalThis.Array<T>(size as number);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/arena.go::method::Arena.NewSlice1","kind":"method","status":"implemented","sigHash":"4992a47dcf040851aaf48bfd2287241d7af83d638266ca8a84a954dfd0c34ea8","bodyHash":"c17187b13925bf4d4021e37e5e794b8a3eba83c54d739f6d706f6d54a7fde037"}
 *
 * Go source:
 * func (a *Arena[T]) NewSlice1(t T) []T {
 * 	slice := a.NewSlice(1)
 * 	slice[0] = t
 * 	return slice
 * }
 */
export function Arena_NewSlice1<T>(receiver: GoPtr<Arena<T>>, t: T): GoSlice<T> {
  const slice = Arena_NewSlice(receiver, 1 as int);
  slice[0] = t;
  return slice;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/arena.go::method::Arena.Clone","kind":"method","status":"implemented","sigHash":"27f28fb80bfb60096650cf2a896227f2837f1d4e0e6bda9450442ee99972cd6c","bodyHash":"2a82317a6079eb431f604b475bb86a27c8b3408278a5590d0ead847075f5aa47"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Go arena Clone copies into arena-owned backing storage; JS slices already own stable array storage, so a direct array copy preserves observable slice contents without retaining duplicate entries in Arena.data."}
 *
 * Go source:
 * func (a *Arena[T]) Clone(t []T) []T {
 * 	if len(t) == 0 {
 * 		return nil
 * 	}
 * 	slice := a.NewSlice(len(t))
 * 	copy(slice, t)
 * 	return slice
 * }
 */
export function Arena_Clone<T>(receiver: GoPtr<Arena<T>>, t: GoSlice<T>): GoSlice<T> {
  if (t.length === 0) {
    return [];
  }
  ensureArena(receiver);
  return t.slice();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/arena.go::func::nextArenaSize","kind":"func","status":"implemented","sigHash":"145aabd29c835d4b980e31052effdb814889c81c01833bae2f7ebe1098daa5a9","bodyHash":"71790fee17fe7ed0a789352388adab1c6ba32fb02c6b786e64179d0a19086110"}
 *
 * Go source:
 * func nextArenaSize(size int) int {
 * 	// This compiles down branch-free.
 * 	size = max(size, 1)
 * 	size = min(size*2, 256)
 * 	return size
 * }
 */
export function nextArenaSize(size: int): int {
  const s1 = globalThis.Math.max(size as number, 1) as int;
  return globalThis.Math.min((s1 as number) * 2, 256) as int;
}
