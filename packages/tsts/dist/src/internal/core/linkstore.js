import { Arena_New } from "./arena.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/linkstore.go::method::LinkStore.Get","kind":"method","status":"implemented","sigHash":"9c97508aca07f6b6e2bf5511597c28312a377451b939490932beace4e6ef9302","bodyHash":"cd5a7b8c74bdc88653e14f17ac4a9cc7a2477b68dce2267a511e203b1cdfbc43"}
 *
 * Go source:
 * func (s *LinkStore[K, V]) Get(key K) *V {
 * 	value := s.entries[key]
 * 	if value != nil {
 * 		return value
 * 	}
 * 	if s.entries == nil {
 * 		s.entries = make(map[K]*V)
 * 	}
 * 	value = s.arena.New()
 * 	s.entries[key] = value
 * 	return value
 * }
 */
export function LinkStore_Get(receiver, key) {
    const s = receiver;
    s.entries ??= new Map();
    let value = s.entries.get(key);
    if (value !== undefined) {
        return value;
    }
    value = Arena_New(s.arena);
    s.entries.set(key, value);
    return value;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/linkstore.go::method::LinkStore.Has","kind":"method","status":"implemented","sigHash":"d5412e68d7db372e005a7c9c2bd542d118470c5383a0760a238b2134d55819ac","bodyHash":"7d2e78981d32fad14ba0add648e02289d600203bd445b3309303f07e1a8744e6"}
 *
 * Go source:
 * func (s *LinkStore[K, V]) Has(key K) bool {
 * 	_, ok := s.entries[key]
 * 	return ok
 * }
 */
export function LinkStore_Has(receiver, key) {
    const ok = receiver.entries?.has(key) ?? false;
    return ok;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/linkstore.go::method::LinkStore.TryGet","kind":"method","status":"implemented","sigHash":"3a7132f57e6bba51b9aa2b4955552b724fd1f6ae43a4ce9cf4963364414143d2","bodyHash":"a5de5e2605d505368e30e29e85bb2fef91bc49a0cec1079a90c737b49da8aa1b"}
 *
 * Go source:
 * func (s *LinkStore[K, V]) TryGet(key K) *V {
 * 	return s.entries[key]
 * }
 */
export function LinkStore_TryGet(receiver, key) {
    return receiver.entries?.get(key);
}
//# sourceMappingURL=linkstore.js.map