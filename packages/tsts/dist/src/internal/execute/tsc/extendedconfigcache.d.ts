import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import { Mutex } from "../../../go/sync.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { ExtendedConfigCache as ExtendedConfigCache_f02f7376, ExtendedConfigCacheEntry, ParseConfigHost } from "../../tsoptions/tsconfigparsing.js";
import type { Path } from "../../tspath/path.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/extendedconfigcache.go::type::ExtendedConfigCache","kind":"type","status":"implemented","sigHash":"1b52b82667615aefc15acf9d7aa6dbe59c12376e0718375a18c85e3a9f6ade13","bodyHash":"16b956a0a6c87fb4d8a04cedc5d547a2e935e0ee4f0e23c018e9fd01ed1689f7"}
 *
 * Go source:
 * ExtendedConfigCache struct {
 * 	m collections.SyncMap[tspath.Path, *extendedConfigCacheEntry]
 * }
 */
export interface ExtendedConfigCache {
    m: SyncMap<Path, GoPtr<extendedConfigCacheEntry>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/extendedconfigcache.go::type::extendedConfigCacheEntry","kind":"type","status":"implemented","sigHash":"33a3944620d039898ebd8313ee2d0cb396b0ab0d9619ccba4171a54509d2a8ab","bodyHash":"5ce44b7f0e315e1081d9bdf8aa47d454ecc9782902b2bc261033f4c9ec2c07dd"}
 *
 * Go source:
 * extendedConfigCacheEntry struct {
 * 	*tsoptions.ExtendedConfigCacheEntry
 * 	mu sync.Mutex
 * }
 */
export interface extendedConfigCacheEntry {
    __tsgoEmbedded0?: GoPtr<ExtendedConfigCacheEntry>;
    mu: Mutex;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/extendedconfigcache.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"432e0955e75e4de536c3dd0938aa4ffecd753ec31b3f156120e01786bfce3543"}
 *
 * Go source:
 * var _ tsoptions.ExtendedConfigCache = (*ExtendedConfigCache)(nil)
 */
export declare let __a568fcce_0: ExtendedConfigCache_f02f7376;
export declare function ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(receiver: GoPtr<ExtendedConfigCache>): ExtendedConfigCache_f02f7376;
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
export declare function ExtendedConfigCache_GetExtendedConfig(receiver: GoPtr<ExtendedConfigCache>, fileName: string, path: Path, resolutionStack: GoSlice<string>, host: ParseConfigHost): GoPtr<ExtendedConfigCacheEntry>;
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
export declare function ExtendedConfigCache_loadOrStoreNewLockedEntry(receiver: GoPtr<ExtendedConfigCache>, path: Path): [GoPtr<extendedConfigCacheEntry>, bool];
//# sourceMappingURL=extendedconfigcache.d.ts.map