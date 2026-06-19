import type { bool } from "../../../go/scalars.js";
import type { GoMap, GoPtr, GoSeq, GoSlice } from "../../../go/compat.js";
import type { Once } from "../../../go/sync.js";
import * as maps from "../../../go/maps.js";
import * as slices from "../../../go/slices.js";
import { Set_Add, Set_Keys } from "../../collections/set.js";
import type { Set } from "../../collections/set.js";
import { SyncMap_Keys, SyncMap_Load, SyncMap_Range, SyncMap_Store } from "../../collections/syncmap.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { Path } from "../../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/referencemap.go::type::referenceMap","kind":"type","status":"implemented","sigHash":"c878f94c756d3d168e3dba25ee8358c82b32388a5f352eddc64d6d82c4ac91a9","bodyHash":"c96cc8b2f595fa24bd1639c5155d82ab76f05c41c15c887ed4b3169ec4407bc5"}
 *
 * Go source:
 * referenceMap struct {
 * 	references   collections.SyncMap[tspath.Path, *collections.Set[tspath.Path]]
 * 	referencedBy map[tspath.Path]*collections.Set[tspath.Path]
 * 	referenceBy  sync.Once
 * }
 */
export interface referenceMap {
  references: SyncMap<Path, GoPtr<Set<Path>>>;
  referencedBy: GoMap<Path, GoPtr<Set<Path>>>;
  referenceBy: Once;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/referencemap.go::method::referenceMap.storeReferences","kind":"method","status":"implemented","sigHash":"753506b06cecafad6100ad58b4d1eb74af9f48567b8369819f35ceb5b254c7f8","bodyHash":"0bb05c12fb76d095d132b3beba04fd9ec41e1e7e599a1b1feb7a06efa478bacf"}
 *
 * Go source:
 * func (r *referenceMap) storeReferences(path tspath.Path, refs *collections.Set[tspath.Path]) {
 * 	r.references.Store(path, refs)
 * }
 */
export function referenceMap_storeReferences(receiver: GoPtr<referenceMap>, path: Path, refs: GoPtr<Set<Path>>): void {
  SyncMap_Store(receiver!.references, path, refs);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/referencemap.go::method::referenceMap.getReferences","kind":"method","status":"implemented","sigHash":"f1e2e41ee489ce89734fbb51a96544977c6c5d445605273eff800d156219a722","bodyHash":"f8222a9032ac751be4dbfdf482a301516ff3696f239dfb070a5bbec95da71e5b"}
 *
 * Go source:
 * func (r *referenceMap) getReferences(path tspath.Path) (*collections.Set[tspath.Path], bool) {
 * 	refs, ok := r.references.Load(path)
 * 	return refs, ok
 * }
 */
export function referenceMap_getReferences(receiver: GoPtr<referenceMap>, path: Path): [GoPtr<Set<Path>>, bool] {
  const [refs, ok] = SyncMap_Load(receiver!.references, path);
  return [refs, ok];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/referencemap.go::method::referenceMap.getPathsWithReferences","kind":"method","status":"implemented","sigHash":"5adc65a6f27d1c8679b99db131a2a2904cf1fb2a5e742af8e635c6b4faeff5c9","bodyHash":"5fdfd4694b06026fcb0a66e46acabf0b793ae2b7b0f8cc56cd7e39d3c92272f3"}
 *
 * Go source:
 * func (r *referenceMap) getPathsWithReferences() []tspath.Path {
 * 	return slices.Collect(r.references.Keys())
 * }
 */
export function referenceMap_getPathsWithReferences(receiver: GoPtr<referenceMap>): GoSlice<Path> {
  return slices.Collect(SyncMap_Keys(receiver!.references) as GoSeq<Path>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/referencemap.go::method::referenceMap.getReferencedBy","kind":"method","status":"implemented","sigHash":"469f24d6a0f3b65f150036d5d0bcc8943280d7e4a3f9b7d4c1417f40c703e5f1","bodyHash":"da37ef32bb3f6237166f9c09aa04edb14455408eb1b687360b84f879b31edb0d"}
 *
 * Go source:
 * func (r *referenceMap) getReferencedBy(path tspath.Path) iter.Seq[tspath.Path] {
 * 	r.referenceBy.Do(func() {
 * 		r.referencedBy = make(map[tspath.Path]*collections.Set[tspath.Path])
 * 		r.references.Range(func(key tspath.Path, value *collections.Set[tspath.Path]) bool {
 * 			for ref := range value.Keys() {
 * 				set, ok := r.referencedBy[ref]
 * 				if !ok {
 * 					set = &collections.Set[tspath.Path]{}
 * 					r.referencedBy[ref] = set
 * 				}
 * 				set.Add(key)
 * 			}
 * 			return true
 * 		})
 * 	})
 * 	refs, ok := r.referencedBy[path]
 * 	if ok {
 * 		return maps.Keys(refs.Keys())
 * 	}
 * 	return func(yield func(tspath.Path) bool) {}
 * }
 */
export function referenceMap_getReferencedBy(receiver: GoPtr<referenceMap>, path: Path): GoSeq<Path> {
  receiver!.referenceBy.Do(() => {
    receiver!.referencedBy = new globalThis.Map<Path, GoPtr<Set<Path>>>();
    SyncMap_Range(receiver!.references, (key: Path, value: GoPtr<Set<Path>>): bool => {
      const valueSet = value;
      for (const [ref] of Set_Keys(valueSet)) {
        let set = receiver!.referencedBy!.get(ref);
        if (set === undefined) {
          set = { M: new globalThis.Map<Path, { readonly __tsgoEmpty?: never }>() };
          receiver!.referencedBy!.set(ref, set);
        }
        Set_Add(set, key);
      }
      return true;
    });
  });
  const refs = receiver!.referencedBy?.get(path);
  if (refs !== undefined) {
    return maps.Keys(Set_Keys(refs));
  }
  return (_yield: (value: Path) => bool): void => {};
}
