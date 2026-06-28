import * as maps from "../../go/maps.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteMap.Get","kind":"method","status":"implemented","sigHash":"524fff945dd4c8c999c50f30588706af0cce65c8fc0a20eb0c44639bf22c09f9","bodyHash":"b36a580de9a24569c36c00b07fadf93b4a9b4f19c76c959969d48c5967fe7414"}
 *
 * Go source:
 * func (c *CopyOnWriteMap[K, V]) Get(k K) (V, bool) {
 * 	v, ok := c.m[k]
 * 	return v, ok
 * }
 */
export function CopyOnWriteMap_Get(receiver, k) {
    const ok = receiver.m?.has(k) ?? false;
    return [receiver.m?.get(k), ok];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteMap.Has","kind":"method","status":"implemented","sigHash":"6eaf18f414abd76a374cb9e898eb81fb5a31c208e5813f1225a9a60c1df90792","bodyHash":"5887cae94b70a84478183bfe7fc6fc8f9dc644ff701fa18a623bffc5a12f55cc"}
 *
 * Go source:
 * func (c *CopyOnWriteMap[K, V]) Has(k K) bool {
 * 	_, ok := c.m[k]
 * 	return ok
 * }
 */
export function CopyOnWriteMap_Has(receiver, k) {
    return (receiver.m?.has(k) ?? false);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteMap.Set","kind":"method","status":"implemented","sigHash":"788a0a7860b47d62f6567180f5ec5bbc43a0f84224d416fa3e779ce14061cde8","bodyHash":"d8f84bb83063602c810067c0904386de00a4031b71278910213b8356d20297f4"}
 *
 * Go source:
 * func (c *CopyOnWriteMap[K, V]) Set(k K, v V) {
 * 	c.ensureOwned()
 * 	c.m[k] = v
 * }
 */
export function CopyOnWriteMap_Set(receiver, k, v) {
    CopyOnWriteMap_ensureOwned(receiver);
    receiver.m.set(k, v);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteMap.ensureOwned","kind":"method","status":"implemented","sigHash":"d53a59d9f48f96fc0293e6071a317bc46d984515d43fb60a1cd92e23e912f30b","bodyHash":"76e8d91e23d2a24fe5d173872f9040d96ab5ccc7c2588b8880bb9fd601fa2d83"}
 *
 * Go source:
 * func (c *CopyOnWriteMap[K, V]) ensureOwned() {
 * 	if c.owned {
 * 		return
 * 	}
 * 	if c.m == nil {
 * 		c.m = make(map[K]V)
 * 	} else {
 * 		c.m = maps.Clone(c.m)
 * 	}
 * 	c.owned = true
 * }
 */
export function CopyOnWriteMap_ensureOwned(receiver) {
    if (receiver.owned) {
        return;
    }
    if (receiver.m === undefined) {
        receiver.m = new globalThis.Map();
    }
    else {
        receiver.m = maps.Clone(receiver.m);
    }
    receiver.owned = true;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteMap.EnterScope","kind":"method","status":"implemented","sigHash":"0e626cc295bab1e88b5a443ca42e56195d57fdd88edc8b15de2425578f233094","bodyHash":"5670f95cb05f4303fdc245e04e2c8cf840e1bbbac10b5841f79e7ccc5154cdcb"}
 *
 * Go source:
 * func (c *CopyOnWriteMap[K, V]) EnterScope() func() {
 * 	saved := *c
 * 	c.owned = false
 * 	return func() { *c = saved }
 * }
 */
export function CopyOnWriteMap_EnterScope(receiver) {
    // `saved := *c` copies the struct by value (the backing-map reference and the
    // owned flag); the returned closure restores both via `*c = saved`.
    const saved = { m: receiver.m, owned: receiver.owned };
    receiver.owned = false;
    return () => {
        receiver.m = saved.m;
        receiver.owned = saved.owned;
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteSet.Has","kind":"method","status":"implemented","sigHash":"ccd5e875100b02049c0f1acefd82bf09eb4579fbf7ba588da0f2c1dff071fc93","bodyHash":"5425df1169b65c6d69d2960fb0eea2310748966aca8b410983f41a73d7e0b98a"}
 *
 * Go source:
 * func (c *CopyOnWriteSet[K]) Has(k K) bool {
 * 	_, ok := c.m.Get(k)
 * 	return ok
 * }
 */
export function CopyOnWriteSet_Has(receiver, k) {
    const [, ok] = CopyOnWriteMap_Get(receiver.m, k);
    return ok;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteSet.Add","kind":"method","status":"implemented","sigHash":"350bee723194f4d1bd2c390f4aec3a6ac49d7272d2e35d6228e138ffb59ba1b0","bodyHash":"68e314b602913271c90f2a56df9fde3d68ef025a58a37889e32ada2259ef34e2"}
 *
 * Go source:
 * func (c *CopyOnWriteSet[K]) Add(k K) {
 * 	c.m.Set(k, struct{}{})
 * }
 */
export function CopyOnWriteSet_Add(receiver, k) {
    CopyOnWriteMap_Set(receiver.m, k, {});
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/collections/cow.go::method::CopyOnWriteSet.EnterScope","kind":"method","status":"implemented","sigHash":"8fc81561ca0fca9e2025227618daab8802ee8dfb06edb111cc823f869d159591","bodyHash":"860c3fda7d1267d9d74f5ea58615108b975b2904479c557048d20c209d0ba71c"}
 *
 * Go source:
 * func (c *CopyOnWriteSet[K]) EnterScope() func() {
 * 	return c.m.EnterScope()
 * }
 */
export function CopyOnWriteSet_EnterScope(receiver) {
    return CopyOnWriteMap_EnterScope(receiver.m);
}
//# sourceMappingURL=cow.js.map