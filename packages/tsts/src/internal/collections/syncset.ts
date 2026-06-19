import type { bool, int } from "../../go/scalars.js";
import type { GoComparable, GoPtr, GoSeq, GoSlice } from "../../go/compat.js";
import type { SyncMap } from "./syncmap.js";
import { SyncMap_Delete, SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Range } from "./syncmap.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::type::SyncSet","kind":"type","status":"implemented","sigHash":"570927ea2bf0e4da3a3ad7fdaadd4bd3b7b32ccbc5b750adb2dd0d43ce00e151","bodyHash":"0e2e94afb12a20e228869161c6096511665888582db035691c74d3203f2f7238"}
 *
 * Go source:
 * SyncSet[T comparable] struct {
 * 	m SyncMap[T, struct{}]
 * }
 */
export interface SyncSet<T extends GoComparable = unknown> {
  m: SyncMap<T, { readonly __tsgoEmpty?: never }>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.Has","kind":"method","status":"implemented","sigHash":"bda102f39a3640ceaf05f8aa32bb85c92ab9913ffd0914ca831c6bc00f2ca693","bodyHash":"43a64d33f845113bde9869f3cb5264c21a7464cf57847a260efe38a898f87af4"}
 *
 * Go source:
 * func (s *SyncSet[T]) Has(key T) bool {
 * 	_, ok := s.m.Load(key)
 * 	return ok
 * }
 */
export function SyncSet_Has<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>, key: T): bool {
  const [, ok] = SyncMap_Load(receiver!.m, key);
  return ok;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.Add","kind":"method","status":"implemented","sigHash":"17f2afbd26952225a4933765a22786cf85da3de557aa0e4effac67331f0fb0f7","bodyHash":"1a6f3e99f63b227da9e1d40174ece4601a37b7935e2421050ce678cc087cc4c9"}
 *
 * Go source:
 * func (s *SyncSet[T]) Add(key T) {
 * 	s.AddIfAbsent(key)
 * }
 */
export function SyncSet_Add<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>, key: T): void {
  SyncSet_AddIfAbsent(receiver, key);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.AddIfAbsent","kind":"method","status":"implemented","sigHash":"bb712274c5a0ac98bda050eecb8986c92464f878ee34bb7ca5c95040b0a1a1f4","bodyHash":"2a22f04d30de34881f69ef9894de73cd377271bc769e36a7cb52ea76f2e8be1f"}
 *
 * Go source:
 * func (s *SyncSet[T]) AddIfAbsent(key T) bool {
 * 	_, loaded := s.m.LoadOrStore(key, struct{}{})
 * 	return !loaded
 * }
 */
export function SyncSet_AddIfAbsent<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>, key: T): bool {
  const [, loaded] = SyncMap_LoadOrStore(receiver!.m, key, {});
  return !loaded;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.Delete","kind":"method","status":"implemented","sigHash":"0ba5a3353c582a1a670608fa549418d2bb31ec8fd3c886a1a4e72b77a65450db","bodyHash":"be5624217c4f9cafcb0efb1663f10cd9144529b9afff9592d78d6477be01ef4f"}
 *
 * Go source:
 * func (s *SyncSet[T]) Delete(key T) {
 * 	s.m.Delete(key)
 * }
 */
export function SyncSet_Delete<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>, key: T): void {
  SyncMap_Delete(receiver!.m, key);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.Range","kind":"method","status":"implemented","sigHash":"c9ffe2a2be8783687ef174652bf53f406b7cde65508c366a2b2fe704bd05ad68","bodyHash":"564acaf0c946098fde1b3190b0caccb55210755b6e8cf9605198295cee20afb0"}
 *
 * Go source:
 * func (s *SyncSet[T]) Range(fn func(key T) bool) {
 * 	s.m.Range(func(key T, value struct{}) bool {
 * 		return fn(key)
 * 	})
 * }
 */
export function SyncSet_Range<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>, fn: (key: T) => bool): void {
  SyncMap_Range(receiver!.m, (key: T, _value: { readonly __tsgoEmpty?: never }): bool => {
    return fn(key);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.Size","kind":"method","status":"implemented","sigHash":"1dd97f7397ceec060d9f095862765d569473855c18b14f26007b992f4abc89a6","bodyHash":"0d358c8f3ea07aafac27913dce6ba92e02952726116846594385a2c62dbedbdf"}
 *
 * Go source:
 * func (s *SyncSet[T]) Size() int {
 * 	count := 0
 * 	s.m.Range(func(_ T, _ struct{}) bool {
 * 		count++
 * 		return true
 * 	})
 * 	return count
 * }
 */
export function SyncSet_Size<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>): int {
  const keys: T[] = [];
  SyncMap_Range(receiver!.m, (key: T, _value: { readonly __tsgoEmpty?: never }): bool => {
    keys.push(key);
    return true;
  });
  return keys.length as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.IsEmpty","kind":"method","status":"implemented","sigHash":"f6831d7dcf2b8e4cbfd13799246fa7f4708b9c74d51b2b515308fc05e3fb1a4c","bodyHash":"67212937a14947e8ccde60a4bfe8eefc341fa5664d9770fdd245996e79bda4fa"}
 *
 * Go source:
 * func (s *SyncSet[T]) IsEmpty() bool {
 * 	empty := true
 * 	s.m.Range(func(_ T, _ struct{}) bool {
 * 		empty = false
 * 		return false
 * 	})
 * 
 * 	return empty
 * }
 */
export function SyncSet_IsEmpty<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>): bool {
  return SyncSet_Size(receiver) === 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.ToSlice","kind":"method","status":"implemented","sigHash":"95240efbe0e99cd342b5207fb7d850b032d4a6b5b142fc742ab56451a7805b83","bodyHash":"e8091298d26059431730ddb9627f4049ae5589ee4cc00374f0bc94d57f58641f"}
 *
 * Go source:
 * func (s *SyncSet[T]) ToSlice() []T {
 * 	var arr []T
 * 	arr = make([]T, 0, s.m.Size())
 * 	s.m.Range(func(key T, value struct{}) bool {
 * 		arr = append(arr, key)
 * 		return true
 * 	})
 * 	return arr
 * }
 */
export function SyncSet_ToSlice<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>): GoSlice<T> {
  const arr: GoSlice<T> = [];
  SyncMap_Range(receiver!.m, (key: T, _value: { readonly __tsgoEmpty?: never }): bool => {
    arr.push(key);
    return true;
  });
  return arr;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/syncset.go::method::SyncSet.Keys","kind":"method","status":"implemented","sigHash":"b069d6abff87cf29e964fd68e251ba7f99107b29f09a0c4e0aba17289c162bc3","bodyHash":"89585e9785569f8e68ec631b5ba70f95a74efd35dc9604fa7267c36dfe0109de"}
 *
 * Go source:
 * func (s *SyncSet[T]) Keys() iter.Seq[T] {
 * 	return func(yield func(T) bool) {
 * 		s.m.Range(func(key T, value struct{}) bool {
 * 			if !yield(key) {
 * 				return false
 * 			}
 * 			return true
 * 		})
 * 	}
 * }
 */
export function SyncSet_Keys<T extends GoComparable>(receiver: GoPtr<SyncSet<T>>): GoSeq<T> {
  return (yield_: (value: T) => bool): void => {
    SyncMap_Range(receiver!.m, (key: T, _value: { readonly __tsgoEmpty?: never }): bool => {
      if (!yield_(key)) {
        return false;
      }
      return true;
    });
  };
}
