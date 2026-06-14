import { Map, Mutex } from "../../../go/sync.js";
import { SyncMap_Delete, SyncMap_LoadOrStore, SyncMap_Store } from "../../collections/syncmap.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/parseCache.go::method::parseCache.loadOrStore","kind":"method","status":"implemented","sigHash":"687be8bd3c251584c9bd3de8cf5bf2f89bf4feb2ee573b40939cecde954cff19","bodyHash":"0c49ca42b38e6a25b4e81d01c6d5ee09c130a408729f2a2c293bf34e1f61af0c"}
 *
 * Go source:
 * func (c *parseCache[K, V]) loadOrStore(key K, parse func(K) V, allowZero bool) V {
 * 	newEntry := &parseCacheEntry[V]{}
 * 	newEntry.mu.Lock()
 * 	defer newEntry.mu.Unlock()
 * 	if entry, loaded := c.entries.LoadOrStore(key, newEntry); loaded {
 * 		entry.mu.Lock()
 * 		defer entry.mu.Unlock()
 * 		if allowZero || entry.value != *new(V) {
 * 			return entry.value
 * 		}
 * 		newEntry = entry
 * 	}
 * 	newEntry.value = parse(key)
 * 	return newEntry.value
 * }
 */
export function parseCache_loadOrStore(receiver, key, parse, allowZero) {
    let newEntry = { value: undefined, mu: new Mutex() };
    const [entry, loaded] = SyncMap_LoadOrStore(receiver.entries, key, newEntry);
    if (loaded) {
        if (allowZero || entry.value !== undefined) {
            return entry.value;
        }
        newEntry = entry;
    }
    newEntry.value = parse(key);
    return newEntry.value;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/parseCache.go::method::parseCache.store","kind":"method","status":"implemented","sigHash":"de712529c2c154ace9c8004bdd136f2ad68b3c9876537c35c541721b789e245d","bodyHash":"75134624c1804dadeb40268f40374e1db238a1f950fda8d17f6565b9a9665749"}
 *
 * Go source:
 * func (c *parseCache[K, V]) store(key K, value V) {
 * 	c.entries.Store(key, &parseCacheEntry[V]{value: value})
 * }
 */
export function parseCache_store(receiver, key, value) {
    SyncMap_Store(receiver.entries, key, { value, mu: new Mutex() });
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/parseCache.go::method::parseCache.delete","kind":"method","status":"implemented","sigHash":"272892ac9a7ddf92faaecb351b9543a4a036adc848b61a398fd591728756cab3","bodyHash":"616eb3f0f934504a43fe406ef21c2899f0e8aba5f3f816743535ed2c4e93f1ea"}
 *
 * Go source:
 * func (c *parseCache[K, V]) delete(key K) {
 * 	c.entries.Delete(key)
 * }
 */
export function parseCache_delete(receiver, key) {
    SyncMap_Delete(receiver.entries, key);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/parseCache.go::method::parseCache.reset","kind":"method","status":"implemented","sigHash":"d2536ad10f0efb61f5714b9dfcc024f57a99ca929ba2db4555f211c2eeeb6b61","bodyHash":"368a43467df90eb889cfc6150d1cb432a770ec850575a11c9d041c53bf89c3e6"}
 *
 * Go source:
 * func (c *parseCache[K, V]) reset() {
 * 	c.entries = collections.SyncMap[K, *parseCacheEntry[V]]{}
 * }
 */
export function parseCache_reset(receiver) {
    receiver.entries = { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() };
}
//# sourceMappingURL=parseCache.js.map