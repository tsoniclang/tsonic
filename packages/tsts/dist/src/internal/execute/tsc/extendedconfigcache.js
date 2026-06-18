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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/extendedconfigcache.go::method::ExtendedConfigCache.GetExtendedConfig","kind":"method","status":"implemented","sigHash":"342a3b886bfc1e80e056264bcc745ac2adf85e0f9513581e058fde8934fa6dbf","bodyHash":"437779406ea0323ad1a80d546e49f9c85af904ede419108d463643d30a4183ef"}
 *
 * Go source:
 * func (e *ExtendedConfigCache) GetExtendedConfig(fileName string, path tspath.Path, resolutionStack []string, host tsoptions.ParseConfigHost) *tsoptions.ExtendedConfigCacheEntry {
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