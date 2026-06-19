import type { bool } from "../../go/scalars.js";
import type { GoComparable, GoMap, GoPtr } from "../../go/compat.js";
import type { Arena } from "./arena.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/linkstore.go::type::LinkStore","kind":"type","status":"implemented","sigHash":"96af231f81cab3ea96808ae94d0dd1d2f72fe89e0cdb4c2d385abf3ee3542b3d","bodyHash":"4819b5299d93f83bc94613116fe6aa9f531f2e6c747b99539f472a65af9c96fb"}
 *
 * Go source:
 * LinkStore[K comparable, V any] struct {
 * 	entries map[K]*V
 * 	arena   Arena[V]
 * }
 */
export interface LinkStore<K extends GoComparable = unknown, V = unknown> {
  entries: GoMap<K, GoPtr<V>>;
  arena: Arena<V>;
}

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
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"TSTS constructs all in-scope LinkStores with an eager Map, so Get does not need Go's per-call nil-map branch; JS object references stored in that Map are already stable, so link objects also do not need duplicate retention through the Go arena slice. This preserves observable semantics for constructed stores while removing hot checker map-initialization and arena-retention overhead."}
 */
export function LinkStore_Get<K extends GoComparable, V>(receiver: GoPtr<LinkStore<K, V>>, key: K): GoPtr<V> {
  const entries = receiver!.entries;
  let value = entries.get(key);
  if (value !== undefined) {
    return value;
  }
  value = {} as V;
  entries.set(key, value);
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
export function LinkStore_Has<K extends GoComparable, V>(receiver: GoPtr<LinkStore<K, V>>, key: K): bool {
  const ok = receiver!.entries?.has(key) ?? false;
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
export function LinkStore_TryGet<K extends GoComparable, V>(receiver: GoPtr<LinkStore<K, V>>, key: K): GoPtr<V> {
  return receiver!.entries?.get(key);
}
