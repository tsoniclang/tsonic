import type { bool, int } from "@tsonic/core/types.js";
import type { GoComparable, GoPtr, GoSeq } from "../../go/compat.js";
import type { OrderedMap } from "./ordered_map.js";
import {
  newMapWithSizeHint,
  OrderedMap_clone,
  OrderedMap_Clear,
  OrderedMap_Delete,
  OrderedMap_Has,
  OrderedMap_Keys,
  OrderedMap_Set,
  OrderedMap_Size,
} from "./ordered_map.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::type::OrderedSet","kind":"type","status":"implemented","sigHash":"9617dd085ebe37ef90f0e45fe13271567b43b253466b697708813d109638d735","bodyHash":"ecc0dcaf32a40a6042cce2e143e2338b7c2801ea3b2ad6e8e600b30247470776"}
 *
 * Go source:
 * OrderedSet[T comparable] struct {
 * 	m OrderedMap[T, struct{}]
 * }
 */
export interface OrderedSet<T extends GoComparable = unknown> {
  m: OrderedMap<T, { readonly __tsgoEmpty?: never }>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::func::NewOrderedSetWithSizeHint","kind":"func","status":"implemented","sigHash":"2bd650c681d534d4023474281ecd97208315c6b1f2ec9d49ff10a359d6391c29","bodyHash":"bc73913ed2ed066d1e8bd9314380b49eb98a5b4849a89e99d23404d1d3c47f04"}
 *
 * Go source:
 * func NewOrderedSetWithSizeHint[T comparable](hint int) *OrderedSet[T] {
 * 	return &OrderedSet[T]{
 * 		m: newMapWithSizeHint[T, struct{}](hint),
 * 	}
 * }
 */
export function NewOrderedSetWithSizeHint<T extends GoComparable>(hint: int): GoPtr<OrderedSet<T>> {
  return {
    m: newMapWithSizeHint<T, { readonly __tsgoEmpty?: never }>(hint),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::method::OrderedSet.Add","kind":"method","status":"implemented","sigHash":"8e67ec1a0fffb976220a62deae1a24995548cba5fd22f26d594253e6fb1f44d2","bodyHash":"465440d450596b3ccb8159cf0d0b49a4463593d0d1bf862a8f9a99c7e15b4c26"}
 *
 * Go source:
 * func (s *OrderedSet[T]) Add(value T) {
 * 	s.m.Set(value, struct{}{})
 * }
 */
export function OrderedSet_Add<T>(receiver: GoPtr<OrderedSet<T>>, value: T): void {
  const s = receiver!;
  OrderedMap_Set(s.m, value, {});
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::method::OrderedSet.Has","kind":"method","status":"implemented","sigHash":"fc726e0ab3de530cff8fc45de9db94dd5de759570f2d953762ab20425aaa0c67","bodyHash":"d4afa47d5360036b80e2241d49e3d967a9fed907c7d20e8d385cb6f6bbac7161"}
 *
 * Go source:
 * func (s *OrderedSet[T]) Has(value T) bool {
 * 	return s.m.Has(value)
 * }
 */
export function OrderedSet_Has<T>(receiver: GoPtr<OrderedSet<T>>, value: T): bool {
  const s = receiver!;
  return OrderedMap_Has(s.m, value);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::method::OrderedSet.Delete","kind":"method","status":"implemented","sigHash":"1de758c0c30fa12a3f098df86d3f59ea146c62abf15029cc975efe870591ed42","bodyHash":"c00d331e0422db8ccd74f00b9319f92c82391b1b0e74f10e7f491947892104f0"}
 *
 * Go source:
 * func (s *OrderedSet[T]) Delete(value T) bool {
 * 	_, ok := s.m.Delete(value)
 * 	return ok
 * }
 */
export function OrderedSet_Delete<T>(receiver: GoPtr<OrderedSet<T>>, value: T): bool {
  const s = receiver!;
  const [, ok] = OrderedMap_Delete(s.m, value);
  return ok;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::method::OrderedSet.Values","kind":"method","status":"implemented","sigHash":"108393af0665cf90629b8441fb4c1764f3691ff1c3db2b1599b4d87157b29991","bodyHash":"2186140d75df83d6736187d844d63eda80713aa2103722b4c1e0bcba47e34b9c"}
 *
 * Go source:
 * func (s *OrderedSet[T]) Values() iter.Seq[T] {
 * 	return s.m.Keys()
 * }
 */
export function OrderedSet_Values<T>(receiver: GoPtr<OrderedSet<T>>): GoSeq<T> {
  const s = receiver!;
  return OrderedMap_Keys(s.m);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::method::OrderedSet.Clear","kind":"method","status":"implemented","sigHash":"f4d302272583e3d741a18e6551910ad9cabfb2ce5da6ccc26995e45add84a66c","bodyHash":"9389964c2c086045d2cdc75bc8116294a02b60725fbf75349856f34d7d08c2fb"}
 *
 * Go source:
 * func (s *OrderedSet[T]) Clear() {
 * 	s.m.Clear()
 * }
 */
export function OrderedSet_Clear<T>(receiver: GoPtr<OrderedSet<T>>): void {
  const s = receiver!;
  OrderedMap_Clear(s.m);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::method::OrderedSet.Size","kind":"method","status":"implemented","sigHash":"6943604c4066668ad4826edc3d8535bafae7ae5d201a1cd8919c63dceef3e31d","bodyHash":"1378e4ce7d2532cce1046f9325e5f18e3384813f655d8b89b227c7ae7430d631"}
 *
 * Go source:
 * func (s *OrderedSet[T]) Size() int {
 * 	return s.m.Size()
 * }
 */
export function OrderedSet_Size<T>(receiver: GoPtr<OrderedSet<T>>): int {
  const s = receiver!;
  return OrderedMap_Size(s.m);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/ordered_set.go::method::OrderedSet.Clone","kind":"method","status":"implemented","sigHash":"848e18191b0e69ad1571be58d996bac53dbb50dfb8f38f6ee98b97dcc556f37b","bodyHash":"f85467141d4ac24f6deb0b0c8ffa10f94ed4488b91f34449345d467ad7570134"}
 *
 * Go source:
 * func (s *OrderedSet[T]) Clone() *OrderedSet[T] {
 * 	return &OrderedSet[T]{
 * 		m: s.m.clone(),
 * 	}
 * }
 */
export function OrderedSet_Clone<T>(receiver: GoPtr<OrderedSet<T>>): GoPtr<OrderedSet<T>> {
  const s = receiver!;
  return {
    m: OrderedMap_clone(s.m),
  };
}
