import { Mutex } from "../../../go/sync.js";
import { SyncMap_LoadOrStore } from "../../collections/syncmap.js";
import { ParseExtendedConfig } from "../../tsoptions/tsconfigparsing.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/extendedconfigcache.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"432e0955e75e4de536c3dd0938aa4ffecd753ec31b3f156120e01786bfce3543"}
 *
 * Go source:
 * var _ tsoptions.ExtendedConfigCache = (*ExtendedConfigCache)(nil)
 */
export let __a568fcce_0 = ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(undefined);
export function ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(receiver) {
    return {
        GetExtendedConfig: (fileName, path, resolutionStack, host) => ExtendedConfigCache_GetExtendedConfig(receiver, fileName, path, resolutionStack, host),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/extendedconfigcache.go::method::ExtendedConfigCache.GetExtendedConfig","kind":"method","status":"implemented","sigHash":"8e57132a1193eeffdb2a9ec5d5afe5e80ec35eec864063ee085f3613b4e87015","bodyHash":"e3c5e1e9c0eeb39d38c8e2f90c2dd976f7810d53798257858b0fc2a10092f8a3"}
 *
 * Go source:
 * func (e *ExtendedConfigCache) GetExtendedConfig(fileName string, path tspath.Path, resolutionStack []tspath.Path, host tsoptions.ParseConfigHost) *tsoptions.ExtendedConfigCacheEntry {
 * 	entry, loaded := e.loadOrStoreNewLockedEntry(path)
 * 	defer entry.mu.Unlock()
 * 	if !loaded {
 * 		entry.ExtendedConfigCacheEntry = tsoptions.ParseExtendedConfig(fileName, path, resolutionStack, host, e)
 * 	}
 * 	return entry.ExtendedConfigCacheEntry
 * }
 */
export function ExtendedConfigCache_GetExtendedConfig(receiver, fileName, path, resolutionStack, host) {
    const [entry, loaded] = ExtendedConfigCache_loadOrStoreNewLockedEntry(receiver, path);
    try {
        if (!loaded) {
            entry.__tsgoEmbedded0 = ParseExtendedConfig(fileName, path, resolutionStack, host, ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(receiver));
        }
        return entry.__tsgoEmbedded0;
    }
    finally {
        entry.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/extendedconfigcache.go::method::ExtendedConfigCache.loadOrStoreNewLockedEntry","kind":"method","status":"implemented","sigHash":"ab2e292ce94004a8cf826497b03adb48e3f1dfca4ed7e0ae01cff17354af5869","bodyHash":"e75a005fa9ff77f0b0a6d9a52f457bfb46a548c53a75b7af3af866f17b24a793"}
 *
 * Go source:
 * func (c *ExtendedConfigCache) loadOrStoreNewLockedEntry(path tspath.Path) (*extendedConfigCacheEntry, bool) {
 * 	entry := &extendedConfigCacheEntry{}
 * 	entry.mu.Lock()
 * 	if existing, loaded := c.m.LoadOrStore(path, entry); loaded {
 * 		existing.mu.Lock()
 * 		return existing, true
 * 	}
 * 	return entry, false
 * }
 */
export function ExtendedConfigCache_loadOrStoreNewLockedEntry(receiver, path) {
    const entry = { __tsgoEmbedded0: undefined, mu: new Mutex() };
    entry.mu.Lock();
    const [existing, loaded] = SyncMap_LoadOrStore(receiver.m, path, entry);
    if (loaded) {
        existing.mu.Lock();
        return [existing, true];
    }
    return [entry, false];
}
//# sourceMappingURL=extendedconfigcache.js.map