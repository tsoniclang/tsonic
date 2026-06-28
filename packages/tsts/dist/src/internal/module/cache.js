import { Map, Once } from "../../go/sync.js";
import { SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Store } from "../collections/syncmap.js";
import { NewInfoCache } from "../packagejson/cache.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/cache.go::method::moduleResolutionCache.Get","kind":"method","status":"implemented","sigHash":"d3e2923c1615b89358992c51f5e2505b58219f435d49e06062686de2082c268b","bodyHash":"28c694be385e53f33006d79c2ae0661a56d95a0343eaa89ec263e9c0d8e785b5"}
 *
 * Go source:
 * func (c *moduleResolutionCache) Get(key moduleResolutionCacheKey) (*ResolvedModule, bool) {
 * 	return c.cache.Load(key)
 * }
 */
export function moduleResolutionCache_Get(receiver, key) {
    return SyncMap_Load(receiver.cache, key);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/cache.go::method::moduleResolutionCache.Set","kind":"method","status":"implemented","sigHash":"e06f4591536431344b2f2372edf63bd6fd38978018999a1d176025a05e091cc8","bodyHash":"26ea61363acf1f3c63fb3e455e3f14223fd0ec609df2777031373fd6bffbe58a"}
 *
 * Go source:
 * func (c *moduleResolutionCache) Set(key moduleResolutionCacheKey, value *ResolvedModule) {
 * 	c.cache.LoadOrStore(key, value)
 * }
 */
export function moduleResolutionCache_Set(receiver, key, value) {
    SyncMap_LoadOrStore(receiver.cache, key, value);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/cache.go::method::typeRefDirectiveResolutionCache.Get","kind":"method","status":"implemented","sigHash":"c7ba3965585e90fd056502af18e8e8ec5c86e305ff6d7cf845a369c37ef28b45","bodyHash":"368ce9604408a294d4eb0af3dd3101d20a71603d10a2b19c77ed674fe6f5f2bc"}
 *
 * Go source:
 * func (c *typeRefDirectiveResolutionCache) Get(key typeRefDirectiveResolutionCacheKey) (*ResolvedTypeReferenceDirective, bool) {
 * 	return c.cache.Load(key)
 * }
 */
export function typeRefDirectiveResolutionCache_Get(receiver, key) {
    return SyncMap_Load(receiver.cache, key);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/cache.go::method::typeRefDirectiveResolutionCache.Set","kind":"method","status":"implemented","sigHash":"9633cc28aa0ecc82cd4d7b3fcddbf46663e21a236495c7fc3a1a71d26f1b75b8","bodyHash":"46d41088eedb41cae8e988e233136f0a001ba2887aff89533f5a374e94d97f64"}
 *
 * Go source:
 * func (c *typeRefDirectiveResolutionCache) Set(key typeRefDirectiveResolutionCacheKey, value *ResolvedTypeReferenceDirective) {
 * 	c.cache.Store(key, value)
 * }
 */
export function typeRefDirectiveResolutionCache_Set(receiver, key, value) {
    SyncMap_Store(receiver.cache, key, value);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/cache.go::func::newCaches","kind":"func","status":"implemented","sigHash":"ed7e5bbac1fdd252c9985c4c1c91f9a0573d2204c422b5b757ca6aa9e903bb8a","bodyHash":"f0a8f8fbe3cad29e658e2a55e745c1c6ad73eae4aa2bd361efb13a58f3f48c51"}
 *
 * Go source:
 * func newCaches(
 * 	currentDirectory string,
 * 	useCaseSensitiveFileNames bool,
 * 	options *core.CompilerOptions,
 * ) caches {
 * 	return caches{
 * 		packageJsonInfoCache: packagejson.NewInfoCache(currentDirectory, useCaseSensitiveFileNames),
 * 	}
 * }
 */
export function newCaches(currentDirectory, useCaseSensitiveFileNames, options) {
    return {
        packageJsonInfoCache: NewInfoCache(currentDirectory, useCaseSensitiveFileNames),
        moduleResolutionCache: { cache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() } },
        typeRefDirectiveResolutionCache: { cache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() } },
        parsedPatternsForPathsOnce: new Once(),
        parsedPatternsForPaths: undefined,
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/cache.go::func::getRedirectConfigName","kind":"func","status":"implemented","sigHash":"c73d7d1d07689bf4be9d6b7d7a67ec3d31f4fd31ef272958e8aee9233f4d9aa2","bodyHash":"b720fc09bfed2ba77e015c3d013f672a6cc8138807cea57bf635a6460c762690"}
 *
 * Go source:
 * func getRedirectConfigName(redirect ResolvedProjectReference) string {
 * 	if redirect == nil {
 * 		return ""
 * 	}
 * 	return redirect.ConfigName()
 * }
 */
export function getRedirectConfigName(redirect) {
    if (redirect === undefined) {
        return "";
    }
    return redirect.ConfigName();
}
//# sourceMappingURL=cache.js.map