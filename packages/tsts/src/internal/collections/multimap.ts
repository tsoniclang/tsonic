import type { bool, int } from "../../go/scalars.js";
import type { GoComparable, GoMap, GoPtr, GoSeq, GoSlice } from "../../go/compat.js";
import * as maps from "../../go/maps.js";
import * as slices from "../../go/slices.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::type::MultiMap","kind":"type","status":"implemented","sigHash":"955c1a2ed6ee58a00a33eb9d83a514b829e17934a40779d6671c3715322c6279","bodyHash":"5fa746f9ad8184af45af12e61f174c3763b0f6e232c9d3cf29c17b36e4bd2f94"}
 *
 * Go source:
 * MultiMap[K comparable, V comparable] struct {
 * 	M map[K][]V
 * }
 */
export interface MultiMap<K extends GoComparable = unknown, V extends GoComparable = unknown> {
  M: GoMap<K, GoSlice<V>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::func::NewMultiMapWithSizeHint","kind":"func","status":"implemented","sigHash":"58f9bfeafa8eb6db3f0b665be009113ad9db3a0790abd5ce6f4165ae005cc499","bodyHash":"76fdbd07da140975990367c04c6752f5dcdfeaaaa58d4eabb73e8dbc580e75e9"}
 *
 * Go source:
 * func NewMultiMapWithSizeHint[K comparable, V comparable](hint int) *MultiMap[K, V] {
 * 	return &MultiMap[K, V]{
 * 		M: make(map[K][]V, hint),
 * 	}
 * }
 */
export function NewMultiMapWithSizeHint<K extends GoComparable, V extends GoComparable>(hint: int): GoPtr<MultiMap<K, V>> {
  return {
    M: new globalThis.Map<K, GoSlice<V>>(),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::func::GroupBy","kind":"func","status":"implemented","sigHash":"dca9bec35095fffba77521f0103dbd239076e0eb2c1ab06c3a4224e7d3b0f013","bodyHash":"7822315175c81430eee5308574a659fac3885eaeea5dff6f9665a93c51b4a4b1"}
 *
 * Go source:
 * func GroupBy[K comparable, V comparable](items []V, groupId func(V) K) *MultiMap[K, V] {
 * 	m := &MultiMap[K, V]{}
 * 	for _, item := range items {
 * 		m.Add(groupId(item), item)
 * 	}
 * 	return m
 * }
 */
export function GroupBy<K extends GoComparable, V extends GoComparable>(items: GoSlice<V>, groupId: (arg0: V) => K): GoPtr<MultiMap<K, V>> {
  const m: MultiMap<K, V> = { M: new globalThis.Map<K, GoSlice<V>>() };
  for (const item of items) {
    MultiMap_Add(m, groupId(item), item);
  }
  return m;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Has","kind":"method","status":"implemented","sigHash":"f0b00bccc54335d4e0fcc9c112aa1accca3c8ae9fdce4405888095d8c06f4917","bodyHash":"3f473dbf756ee8dfa6db69d38e7ba21ac67eaf91140ee93a018d6bbae1b5062d"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Has(key K) bool {
 * 	_, ok := s.M[key]
 * 	return ok
 * }
 */
export function MultiMap_Has<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>, key: K): bool {
  const ok = receiver!.M.has(key);
  return ok;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Get","kind":"method","status":"implemented","sigHash":"a0be42680e41c44ecfbdd545e85e250c152199f88dfb03d99e9584f3cd0d4a6b","bodyHash":"1332a3f04d8741cb2ec1496e62d8f40fccf6852eeeb44f6ee79fcb48eee1403f"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Get(key K) []V {
 * 	return s.M[key]
 * }
 */
export function MultiMap_Get<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>, key: K): GoSlice<V> {
  return receiver!.M.get(key) ?? [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Add","kind":"method","status":"implemented","sigHash":"64e28fd3385c790f5abed8cd688703d0bccb64cbb070ade258ebc3569f0f41f9","bodyHash":"ad6be02dcbb62cccb6070e77430dad74c90064fe07cae05407ebafe4aac5e9d2"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Add(key K, value V) {
 * 	if s.M == nil {
 * 		s.M = make(map[K][]V)
 * 	}
 * 	s.M[key] = append(s.M[key], value)
 * }
 */
export function MultiMap_Add<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>, key: K, value: V): void {
  const existing = receiver!.M.get(key) ?? [];
  existing.push(value);
  receiver!.M.set(key, existing);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Remove","kind":"method","status":"implemented","sigHash":"0ea0dff4fd3e8f01b8ae63b0221510a18d7c70c86e185367cfc9ddfccfcf9f03","bodyHash":"517b151fc0f210d4176980dc17f8d8dace9188d40d5849430799103a459587ae"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Remove(key K, value V) {
 * 	if values, ok := s.M[key]; ok {
 * 		i := slices.Index(values, value)
 * 		if i >= 0 {
 * 			if len(values) == 1 {
 * 				delete(s.M, key)
 * 			} else {
 * 				values = append(values[:i], values[i+1:]...)
 * 				s.M[key] = values
 * 			}
 * 		}
 * 	}
 * }
 */
export function MultiMap_Remove<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>, key: K, value: V): void {
  const values0 = receiver!.M.get(key);
  if (values0 !== undefined) {
    const i = slices.Index(values0, value);
    if (i >= 0) {
      if (values0.length === 1) {
        receiver!.M.delete(key);
      } else {
        receiver!.M.set(key, values0.slice(0, i).concat(values0.slice(i + 1)));
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.RemoveAll","kind":"method","status":"implemented","sigHash":"2743e289f7d0c8ede0d6ff9a90100121addc29eaed0c6fa80a982def77ea0aa7","bodyHash":"b8dd477d1825c6e698454ff9955968105c9ccabadc7c2cc145c1d41a721f59e2"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) RemoveAll(key K) {
 * 	delete(s.M, key)
 * }
 */
export function MultiMap_RemoveAll<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>, key: K): void {
  receiver!.M.delete(key);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Len","kind":"method","status":"implemented","sigHash":"9545983b0c0717a575d026b1f087f18ac050729af3be83dcafa3c11948e7e157","bodyHash":"f79bb4c2a8d5cc62695c0ec8dd3669686b83599dc9c3d10d0f5f9004f7e91102"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Len() int {
 * 	return len(s.M)
 * }
 */
export function MultiMap_Len<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>): int {
  return receiver!.M.size;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Keys","kind":"method","status":"implemented","sigHash":"97eee82df00b25ee006c042e379c1f353455a028cc92e76d9ed0c6221a179d8e","bodyHash":"d13a8c04aad4d4efe8f7011709d56a9cbddfc915be4b6b413269221535f04894"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Keys() iter.Seq[K] {
 * 	return maps.Keys(s.M)
 * }
 */
export function MultiMap_Keys<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>): GoSeq<K> {
  return maps.Keys(receiver!.M);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Values","kind":"method","status":"implemented","sigHash":"51776984b3391916439a0cf3d348cf1e6c6f23aa1e959dca2f762e1a87079d7a","bodyHash":"ec6096e877e54b544335718313ba6bb768cc1139c4d659720cf5fdd9b52eaf08"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Values() iter.Seq[[]V] {
 * 	return maps.Values(s.M)
 * }
 */
export function MultiMap_Values<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>): GoSeq<GoSlice<V>> {
  return maps.Values(receiver!.M);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/multimap.go::method::MultiMap.Clear","kind":"method","status":"implemented","sigHash":"a20f480be4680cd7692932a9a1b2ab300aeb8bda8838b0f14a7e39f23eb80d4c","bodyHash":"a52890acd840a5e1a7fb14d5c68ae063fa08e43f0365a1f5b0163ae4f0b04453"}
 *
 * Go source:
 * func (s *MultiMap[K, V]) Clear() {
 * 	clear(s.M)
 * }
 */
export function MultiMap_Clear<K extends GoComparable, V extends GoComparable>(receiver: GoPtr<MultiMap<K, V>>): void {
  receiver!.M.clear();
}
