/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"40806af4d083ee60cd32fba501ca2d4573a32c6b11de2ce9e9d70b5833e0a5f6"}
 *
 * Go source:
 * var _ Semaphore = UnlimitedSemaphore{}
 */
export const __c5a93a22_0 = UnlimitedSemaphore_as_Semaphore({});
export function UnlimitedSemaphore_as_Semaphore(receiver) {
    return {
        Acquire: () => UnlimitedSemaphore_Acquire(receiver),
        TryAcquire: (ctx) => UnlimitedSemaphore_TryAcquire(receiver, ctx),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::method::UnlimitedSemaphore.Acquire","kind":"method","status":"implemented","sigHash":"8e89f6580320ea7abac003538bed405d60480b61c95cdcccc30c024e5d2c2b9b","bodyHash":"35571c55171a0f5098bca889f7d70348a8e10d91f5b6625885edbd31b532b4a7"}
 *
 * Go source:
 * func (s UnlimitedSemaphore) Acquire() (release func()) {
 * 	return func() {}
 * }
 */
export function UnlimitedSemaphore_Acquire(receiver) {
    return () => { };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::method::UnlimitedSemaphore.TryAcquire","kind":"method","status":"implemented","sigHash":"a208907f89ab2eff86e63e32a8ba56ed052dca01199d3643d8703be45ee3c513","bodyHash":"1e2185cb1d8a07e2c8ce57d677ac6f780ef3074fc972ec74852145df0fead446"}
 *
 * Go source:
 * func (s UnlimitedSemaphore) TryAcquire(ctx context.Context) (release func(), acquired bool) {
 * 	return func() {}, true
 * }
 */
export function UnlimitedSemaphore_TryAcquire(receiver, ctx) {
    return [() => { }, true];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::varGroup::_::#2","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"885b7d813d988f2aca2493f846704ef98d7920435e5c9b174de4ec20b89478e7"}
 *
 * Go source:
 * var _ Semaphore = (*LimitedSemaphore)(nil)
 */
export const __1cad8911_0 = LimitedSemaphore_as_Semaphore(undefined);
export function LimitedSemaphore_as_Semaphore(receiver) {
    return {
        Acquire: () => LimitedSemaphore_Acquire(receiver),
        TryAcquire: (ctx) => LimitedSemaphore_TryAcquire(receiver, ctx),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::func::NewLimitedSemaphore","kind":"func","status":"implemented","sigHash":"04ea60e6edd31c8d707f046528fee535e40e99379fbc42e23567268d23e8f132","bodyHash":"6b62640d18477fb112e0f3753f5c3ee70d38e5b5c192cfcc167f420c15073797"}
 *
 * Go source:
 * func NewLimitedSemaphore(maxConcurrency int) *LimitedSemaphore {
 * 	if maxConcurrency <= 0 {
 * 		panic("maxConcurrency must be positive")
 * 	}
 * 	s := &LimitedSemaphore{
 * 		ch: make(chan struct{}, maxConcurrency),
 * 	}
 * 	s.release = func() { <-s.ch }
 * 	return s
 * }
 */
export function NewLimitedSemaphore(maxConcurrency) {
    if (maxConcurrency <= 0) {
        throw new globalThis.Error("maxConcurrency must be positive");
    }
    const s = {
        ch: {},
        release: () => { },
    };
    return s;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::method::LimitedSemaphore.Acquire","kind":"method","status":"implemented","sigHash":"b6946d2579c55c04567c62dd8298fcb819eb4ed2f84eecdee53fc9a6cee3e3a4","bodyHash":"83f874bf20143bc4a8548b65a993a7c13b4ba3fa6953c236fed25b5348ab8d88"}
 *
 * Go source:
 * func (s *LimitedSemaphore) Acquire() (release func()) {
 * 	s.ch <- struct{}{}
 * 	return s.release
 * }
 */
export function LimitedSemaphore_Acquire(receiver) {
    // Single-threaded: channel send never blocks; return the stored release function.
    return receiver.release;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::method::LimitedSemaphore.TryAcquire","kind":"method","status":"implemented","sigHash":"445bd0e58d03cc995179f2b01adc3b80adf8bc693fe894f99c491b0590656a1c","bodyHash":"8450a2a545ce6cf65675f7e300fbb763964a16e9469d9a841358c85d04e7ff66"}
 *
 * Go source:
 * func (s *LimitedSemaphore) TryAcquire(ctx context.Context) (release func(), acquired bool) {
 * 	select {
 * 	case s.ch <- struct{}{}:
 * 		return s.release, true
 * 	case <-ctx.Done():
 * 		return func() {}, false
 * 	}
 * }
 */
export function LimitedSemaphore_TryAcquire(receiver, ctx) {
    // Single-threaded: select always takes the acquire branch (no ctx.Done blocking).
    return [receiver.release, true];
}
//# sourceMappingURL=semaphore.js.map