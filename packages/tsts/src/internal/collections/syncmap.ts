import type { bool, int } from "@tsonic/core/types.js";
import type { GoArray, GoComparable, GoMap, GoPtr, GoSeq } from "../../go/compat.js";
import { Map } from "../../go/sync.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::type::SyncMap","kind":"type","status":"implemented","sigHash":"4f6f655e995f945c3130474631c32240c46c5dd0b984a67769b1fe2ed69a7fa9","bodyHash":"fdc45c613dbb64f7a1c093e977b4bdb29dd6477913552f974a1aa70ac112fb64"}
 *
 * Go source:
 * SyncMap[K comparable, V any] struct {
 * 	_ [0]K
 * 	_ [0]V
 * 	m sync.Map
 * }
 */
export interface SyncMap<K extends GoComparable = unknown, V = unknown> {
  __tsgoBlank0: GoArray<K, "0">;
  __tsgoBlank1: GoArray<V, "0">;
  m: Map;
}

function syncMapBacking<K extends GoComparable, V>(receiver: GoPtr<SyncMap<K, V>>): Map {
  if (receiver === undefined) {
    return new Map();
  }
  if (receiver.m === undefined) {
    receiver.m = new Map();
  }
  return receiver.m;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Load","kind":"method","status":"implemented","sigHash":"8742a04ce4355c00eb82c36f8edccdfd8129995ae390641be36caee7a3d59b03","bodyHash":"60b37e9f1fe348dc4008aa59a072a10b28114bfe9fd826a355dda6df6934953a"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Load(key K) (value V, ok bool) {
 * 	val, ok := s.m.Load(key)
 * 	if !ok || val == nil {
 * 		return value, ok
 * 	}
 * 	return val.(V), true
 * }
 */
export function SyncMap_Load<K, V>(receiver: GoPtr<SyncMap<K, V>>, key: K): [V, bool] {
  const value = undefined as V;
  const [val, ok] = syncMapBacking(receiver).Load(key);
  if (!ok || val === undefined) {
    return [value, ok];
  }
  return [val as V, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Store","kind":"method","status":"implemented","sigHash":"94630456ae4112e3622420c4cdb7bcd49b3e850cb36edfaf3780caad2035753f","bodyHash":"a3be0683d0bb178e933481949a6cdfcc305e1581b8a11edb69c169ae19f27c81"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Store(key K, value V) {
 * 	s.m.Store(key, value)
 * }
 */
export function SyncMap_Store<K, V>(receiver: GoPtr<SyncMap<K, V>>, key: K, value: V): void {
  syncMapBacking(receiver).Store(key, value);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.LoadOrStore","kind":"method","status":"implemented","sigHash":"3335e103762a37676b2ccb25628c5df2c2a6f44b6c12b07576fda42848d0a3b6","bodyHash":"ff832a41df237d83e5635b3aaf041bfe31ed4352a90948adcf1c17b59e8c9f23"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) LoadOrStore(key K, value V) (actual V, loaded bool) {
 * 	actualAny, loaded := s.m.LoadOrStore(key, value)
 * 	if actualAny == nil {
 * 		return actual, loaded
 * 	}
 * 
 * 	return actualAny.(V), loaded
 * }
 */
export function SyncMap_LoadOrStore<K, V>(receiver: GoPtr<SyncMap<K, V>>, key: K, value: V): [V, bool] {
  const actual = undefined as V;
  const [actualAny, loaded] = syncMapBacking(receiver).LoadOrStore(key, value);
  if (actualAny === undefined) {
    return [actual, loaded];
  }

  return [actualAny as V, loaded];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Delete","kind":"method","status":"implemented","sigHash":"11c8546058ae28b92e414283ae5fb8baec96f1050f60d153fd6715ef4363a694","bodyHash":"a615c4e6f6e2eff82d701f8c1d6550127bb1d96ca27e2eb01e151711902fcfbe"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Delete(key K) {
 * 	s.m.Delete(key)
 * }
 */
export function SyncMap_Delete<K, V>(receiver: GoPtr<SyncMap<K, V>>, key: K): void {
  syncMapBacking(receiver).Delete(key);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Clear","kind":"method","status":"implemented","sigHash":"6d564106404f48db6f2d622a33eac281d3058ccb99fe7d718f901e909f5f19be","bodyHash":"cd5c17f9a347201561730c3b467b0e36e1667d919e07a83e49f6528a95c6a5d2"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Clear() {
 * 	s.m.Clear()
 * }
 */
export function SyncMap_Clear<K, V>(receiver: GoPtr<SyncMap<K, V>>): void {
  syncMapBacking(receiver).Clear();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Range","kind":"method","status":"implemented","sigHash":"5558fbe590ec5e96bfe465b80469387ab8baca6ae47d614be87642c0ca5cb9c7","bodyHash":"1684c586413bd02ced3502091c1fb02776defe1aa20f63f2e276d93e958ddf45"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Range(f func(key K, value V) bool) {
 * 	s.m.Range(func(key, value any) bool {
 * 		var k K
 * 		if key != nil {
 * 			k = key.(K)
 * 		}
 * 
 * 		var v V
 * 		if value != nil {
 * 			v = value.(V)
 * 		}
 * 
 * 		return f(k, v)
 * 	})
 * }
 */
export function SyncMap_Range<K, V>(receiver: GoPtr<SyncMap<K, V>>, f: (key: K, value: V) => bool): void {
  syncMapBacking(receiver).Range((key: unknown, value: unknown): bool => {
    const k = (key !== undefined ? key as K : undefined as K);
    const v = (value !== undefined ? value as V : undefined as V);
    return f(k, v);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Size","kind":"method","status":"implemented","sigHash":"2784caf4e166218ceae9487fe1139ccb4f3b47f422efcd15d6ff0eb1d8e63ce9","bodyHash":"66cb46593898d53bd09421dc511ad959f7a00a4caa8935f65948b3c5a39ca32e"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Size() int {
 * 	count := 0
 * 	s.m.Range(func(_, _ any) bool {
 * 		count++
 * 		return true
 * 	})
 * 	return count
 * }
 */
export function SyncMap_Size<K, V>(receiver: GoPtr<SyncMap<K, V>>): int {
  const entries: unknown[] = [];
  syncMapBacking(receiver).Range((key: unknown, _value: unknown): bool => {
    entries.push(key);
    return true;
  });
  return entries.length as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.ToMap","kind":"method","status":"implemented","sigHash":"a1b039297e8259bf5a5d29b8f9c25c5a5e9aa49ee48f49e4e3b679b648c6a359","bodyHash":"ed86a3658588d0d5401c7ac87dc4abd87a3e40781f769989001253bfc114ffc3"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) ToMap() map[K]V {
 * 	m := make(map[K]V, s.Size())
 * 	s.m.Range(func(key, value any) bool {
 * 		m[key.(K)] = value.(V)
 * 		return true
 * 	})
 * 	return m
 * }
 */
export function SyncMap_ToMap<K, V>(receiver: GoPtr<SyncMap<K, V>>): GoMap<K, V> {
  const m = new globalThis.Map<K, V>();
  syncMapBacking(receiver).Range((key: unknown, value: unknown): bool => {
    m.set(key as K, value as V);
    return true;
  });
  return m;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Keys","kind":"method","status":"implemented","sigHash":"1b5ef426912c42096e3c6a500619def74fda575ef9ff8375b4091de3de8aef05","bodyHash":"ef89b8072199ea9883e39d4196a7d48569e01d46bec89b3e9832a1532052d02b"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Keys() iter.Seq[K] {
 * 	return func(yield func(K) bool) {
 * 		s.m.Range(func(key, value any) bool {
 * 			if !yield(key.(K)) {
 * 				return false
 * 			}
 * 			return true
 * 		})
 * 	}
 * }
 */
export function SyncMap_Keys<K, V>(receiver: GoPtr<SyncMap<K, V>>): GoSeq<K> {
  return (yield_: (value: K) => bool): void => {
    syncMapBacking(receiver).Range((key: unknown, _value: unknown): bool => {
      if (!yield_(key as K)) {
        return false;
      }
      return true;
    });
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncmap.go::method::SyncMap.Clone","kind":"method","status":"implemented","sigHash":"96b7f45a1626d0905a2caf4520cffd4055c3d6e783a207f03df5c102a7615dd4","bodyHash":"d41095521ff69bdaf51d861b2048e5d89912813170d955a42e112f5294a2283d"}
 *
 * Go source:
 * func (s *SyncMap[K, V]) Clone() *SyncMap[K, V] {
 * 	clone := &SyncMap[K, V]{}
 * 	s.m.Range(func(key, value any) bool {
 * 		clone.m.Store(key, value)
 * 		return true
 * 	})
 * 	return clone
 * }
 */
export function SyncMap_Clone<K, V>(receiver: GoPtr<SyncMap<K, V>>): GoPtr<SyncMap<K, V>> {
  const clone: SyncMap<K, V> = {
    __tsgoBlank0: [],
    __tsgoBlank1: [],
    m: new Map(),
  };
  syncMapBacking(receiver).Range((key: unknown, value: unknown): bool => {
    clone.m.Store(key, value);
    return true;
  });
  return clone;
}
