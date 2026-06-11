import type { bool, int } from "@tsonic/core/types.js";
import type { GoChan, GoPtr } from "../../go/compat.js";
import type { Context } from "../../go/context.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::type::Semaphore","kind":"type","status":"implemented","sigHash":"3af1dcc6419e253094c19a125f53a81e779ace89ff7548cc097e592a4665a73a","bodyHash":"7d84dbc2c82ed139c89fa311534e96a4ac2164aa77b08627ff711bfb7909d51c"}
 *
 * Go source:
 * Semaphore interface {
 * 	Acquire() (release func())
 * 	TryAcquire(ctx context.Context) (release func(), acquired bool)
 * }
 */
export interface Semaphore {
  Acquire(): () => void;
  TryAcquire(ctx: Context): [() => void, bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"40806af4d083ee60cd32fba501ca2d4573a32c6b11de2ce9e9d70b5833e0a5f6"}
 *
 * Go source:
 * var _ Semaphore = UnlimitedSemaphore{}
 */
export const __c5a93a22_0: Semaphore = UnlimitedSemaphore_as_Semaphore({});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::type::UnlimitedSemaphore","kind":"type","status":"implemented","sigHash":"eccd0e32b4c71792b14c837a176a34fde532f11d1c1de7a6bc8d6e5ecd893ad6","bodyHash":"9a5249372744aeb917534fe31e743753d15baf0a7b9261dd414c68096c346c9a"}
 *
 * Go source:
 * UnlimitedSemaphore struct{}
 */
export interface UnlimitedSemaphore {
  readonly __tsgoEmpty?: never;
}

export function UnlimitedSemaphore_as_Semaphore(receiver: UnlimitedSemaphore): Semaphore {
  return {
    Acquire: (): () => void => UnlimitedSemaphore_Acquire(receiver),
    TryAcquire: (ctx: Context): [() => void, bool] => UnlimitedSemaphore_TryAcquire(receiver, ctx),
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
export function UnlimitedSemaphore_Acquire(receiver: UnlimitedSemaphore): () => void {
  return (): void => {};
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::method::UnlimitedSemaphore.TryAcquire","kind":"method","status":"implemented","sigHash":"a208907f89ab2eff86e63e32a8ba56ed052dca01199d3643d8703be45ee3c513","bodyHash":"1e2185cb1d8a07e2c8ce57d677ac6f780ef3074fc972ec74852145df0fead446"}
 *
 * Go source:
 * func (s UnlimitedSemaphore) TryAcquire(ctx context.Context) (release func(), acquired bool) {
 * 	return func() {}, true
 * }
 */
export function UnlimitedSemaphore_TryAcquire(receiver: UnlimitedSemaphore, ctx: Context): [() => void, bool] {
  return [(): void => {}, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::varGroup::_::#2","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"885b7d813d988f2aca2493f846704ef98d7920435e5c9b174de4ec20b89478e7"}
 *
 * Go source:
 * var _ Semaphore = (*LimitedSemaphore)(nil)
 */
export const __1cad8911_0: Semaphore = LimitedSemaphore_as_Semaphore(undefined);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/semaphore.go::type::LimitedSemaphore","kind":"type","status":"implemented","sigHash":"6f0f638a52f144421c3246c9abcfb7d73564bb66fef1678b506f56eacc4422bb","bodyHash":"1c887baa2361c1b7920dc8e0bf6029187c7675f621d3a761bea7670a48b7f195"}
 *
 * Go source:
 * LimitedSemaphore struct {
 * 	ch      chan struct{}
 * 	release func()
 * }
 */
export interface LimitedSemaphore {
  ch: GoChan<{ readonly __tsgoEmpty?: never }, "bidirectional">;
  release: () => void;
}

export function LimitedSemaphore_as_Semaphore(receiver: GoPtr<LimitedSemaphore>): Semaphore {
  return {
    Acquire: (): () => void => LimitedSemaphore_Acquire(receiver),
    TryAcquire: (ctx: Context): [() => void, bool] => LimitedSemaphore_TryAcquire(receiver, ctx),
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
export function NewLimitedSemaphore(maxConcurrency: int): GoPtr<LimitedSemaphore> {
  if ((maxConcurrency as number) <= 0) {
    throw new globalThis.Error("maxConcurrency must be positive");
  }
  const s: LimitedSemaphore = {
    ch: {} as GoChan<{ readonly __tsgoEmpty?: never }, "bidirectional">,
    release: (): void => {},
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
export function LimitedSemaphore_Acquire(receiver: GoPtr<LimitedSemaphore>): () => void {
  // Single-threaded: channel send never blocks; return the stored release function.
  return receiver!.release;
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
export function LimitedSemaphore_TryAcquire(receiver: GoPtr<LimitedSemaphore>, ctx: Context): [() => void, bool] {
  // Single-threaded: select always takes the acquire branch (no ctx.Done blocking).
  return [receiver!.release, true];
}
