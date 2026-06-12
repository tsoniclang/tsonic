import type { bool } from "@tsonic/core/types.js";
import type { GoChan, GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { Context } from "../../go/context.js";
import { type Group, WithContext } from "../../go/golang.org/x/sync/errgroup.js";
import { Mutex, WaitGroup } from "../../go/sync.js";
import { Bool } from "../../go/sync/atomic.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::type::WorkGroup","kind":"type","status":"implemented","sigHash":"19fd930d122948ff76428da13421e7a882e8e100255044419228149409e8e1dc","bodyHash":"54c8ed163b25c1eae3b3b92c524fd93ccdfd4ab1263a584b1651e1a7e79f42d3"}
 *
 * Go source:
 * WorkGroup interface {
 * 	// Queue queues a function to run. It may be invoked immediately, or deferred until RunAndWait.
 * 	// It is not safe to call Queue after RunAndWait has returned.
 * 	Queue(fn func())
 * 
 * 	// RunAndWait runs all queued functions, blocking until they have all completed.
 * 	RunAndWait()
 * }
 */
export interface WorkGroup {
  Queue(fn: () => void): void;
  RunAndWait(): void;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::func::NewWorkGroup","kind":"func","status":"implemented","sigHash":"1ea31ba49674c94947d50bfaf04e58059059eb8b0fc25dea263b3b3338b451d8","bodyHash":"98054b232cc0512af0f9bc21d9881b049da0e30bffec414f830af4e37ed58b4e"}
 *
 * Go source:
 * func NewWorkGroup(singleThreaded bool) WorkGroup {
 * 	if singleThreaded {
 * 		return &singleThreadedWorkGroup{}
 * 	}
 * 	return &parallelWorkGroup{}
 * }
 */
export function NewWorkGroup(singleThreaded: bool): WorkGroup {
  if (singleThreaded) {
    const state: singleThreadedWorkGroup = { done: new Bool(), fnsMu: new Mutex(), fns: [] };
    return singleThreadedWorkGroup_as_WorkGroup(state);
  }
  const state: parallelWorkGroup = { done: new Bool(), wg: new WaitGroup() };
  return parallelWorkGroup_as_WorkGroup(state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::type::parallelWorkGroup","kind":"type","status":"implemented","sigHash":"4d4500126474b71511426859cf60a2c763bbe1c17c56932c609d82ae75356958","bodyHash":"943d3288e34770aa62a99a3c142e00dc3235ad10931bad3d4a5d1b70b67197a0"}
 *
 * Go source:
 * parallelWorkGroup struct {
 * 	done atomic.Bool
 * 	wg   sync.WaitGroup
 * }
 */
export interface parallelWorkGroup {
  done: Bool;
  wg: WaitGroup;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"feba0cf005bcf5d6e05729801a7e3a0c2dec8c34bc116a37e80ba8b18b51086f"}
 *
 * Go source:
 * var _ WorkGroup = (*parallelWorkGroup)(nil)
 */
export const __7c9694b3_0: WorkGroup = parallelWorkGroup_as_WorkGroup(undefined);

export function parallelWorkGroup_as_WorkGroup(receiver: GoPtr<parallelWorkGroup>): WorkGroup {
  return {
    Queue: (fn: () => void): void => parallelWorkGroup_Queue(receiver, fn),
    RunAndWait: (): void => parallelWorkGroup_RunAndWait(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::method::parallelWorkGroup.Queue","kind":"method","status":"implemented","sigHash":"3a613e599ba2aa8046b19e5cea538987a132e970ec82b28e8d9dd4448e04b823","bodyHash":"ab0e077af06b04fdf79a20c4f839d7670dd8cd9d253fc427497de91affd5a466"}
 *
 * Go source:
 * func (w *parallelWorkGroup) Queue(fn func()) {
 * 	if w.done.Load() {
 * 		panic("Queue called after RunAndWait returned")
 * 	}
 * 
 * 	w.wg.Go(func() {
 * 		fn()
 * 	})
 * }
 */
export function parallelWorkGroup_Queue(receiver: GoPtr<parallelWorkGroup>, fn: () => void): void {
  if (receiver!.done.Load()) {
    throw new globalThis.Error("Queue called after RunAndWait returned");
  }
  receiver!.wg.Go(fn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::method::parallelWorkGroup.RunAndWait","kind":"method","status":"implemented","sigHash":"704756b7f57ff3271356ab6aed02912229fae08d2e404ad177d526f9a7ec5472","bodyHash":"10b2d6aa54a4fa62fae878f311cff3c7f935b338fc3112d406fb03f95d44a50c"}
 *
 * Go source:
 * func (w *parallelWorkGroup) RunAndWait() {
 * 	defer w.done.Store(true)
 * 	w.wg.Wait()
 * }
 */
export function parallelWorkGroup_RunAndWait(receiver: GoPtr<parallelWorkGroup>): void {
  receiver!.wg.Wait(); // no-op single-threaded; all queued fns ran synchronously in Queue
  receiver!.done.Store(true as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::type::singleThreadedWorkGroup","kind":"type","status":"implemented","sigHash":"4377453937203ba202a5b83148e4832305e63e89c8af5439bf2dde45ac3bac20","bodyHash":"91bb38ea4911724fa3ad60adffff314f220601c4b722effa1cbea5ff753a2a07"}
 *
 * Go source:
 * singleThreadedWorkGroup struct {
 * 	done  atomic.Bool
 * 	fnsMu sync.Mutex
 * 	fns   []func()
 * }
 */
export interface singleThreadedWorkGroup {
  done: Bool;
  fnsMu: Mutex;
  fns: GoSlice<() => void>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::varGroup::_::#2","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"5da122d1ae9804f860a2993b32f9f119e31b623bfbe89928747ab96e1006479e"}
 *
 * Go source:
 * var _ WorkGroup = (*singleThreadedWorkGroup)(nil)
 */
export const __056fa025_0: WorkGroup = singleThreadedWorkGroup_as_WorkGroup(undefined);

export function singleThreadedWorkGroup_as_WorkGroup(receiver: GoPtr<singleThreadedWorkGroup>): WorkGroup {
  return {
    Queue: (fn: () => void): void => singleThreadedWorkGroup_Queue(receiver, fn),
    RunAndWait: (): void => singleThreadedWorkGroup_RunAndWait(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::method::singleThreadedWorkGroup.Queue","kind":"method","status":"implemented","sigHash":"01ad6bcfb7e5a22d16bf001ed92e5e227494b699f7b81f785d7a7de0efc800e9","bodyHash":"988fed99c77ff7fbd07fa317212524ffb19e5aad06caa4d766fcc3b50b488e06"}
 *
 * Go source:
 * func (w *singleThreadedWorkGroup) Queue(fn func()) {
 * 	if w.done.Load() {
 * 		panic("Queue called after RunAndWait returned")
 * 	}
 * 
 * 	w.fnsMu.Lock()
 * 	defer w.fnsMu.Unlock()
 * 	w.fns = append(w.fns, fn)
 * }
 */
export function singleThreadedWorkGroup_Queue(receiver: GoPtr<singleThreadedWorkGroup>, fn: () => void): void {
  if (receiver!.done.Load()) {
    throw new globalThis.Error("Queue called after RunAndWait returned");
  }
  receiver!.fnsMu.Lock();
  receiver!.fns.push(fn);
  receiver!.fnsMu.Unlock();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::method::singleThreadedWorkGroup.RunAndWait","kind":"method","status":"implemented","sigHash":"469232e5330a9ac7d4f6eebd65beb509d7ab96b7583cc9c25812f5d585c85e28","bodyHash":"d169892c6c034f2206c71dba6e096856c1077ff2a828ed94ee78cbf6f77e0b44"}
 *
 * Go source:
 * func (w *singleThreadedWorkGroup) RunAndWait() {
 * 	defer w.done.Store(true)
 * 	for {
 * 		fn := w.pop()
 * 		if fn == nil {
 * 			return
 * 		}
 * 		fn()
 * 	}
 * }
 */
export function singleThreadedWorkGroup_RunAndWait(receiver: GoPtr<singleThreadedWorkGroup>): void {
  const drain = (): void => {
    const fn = singleThreadedWorkGroup_pop(receiver);
    if (fn !== undefined) {
      fn();
      drain();
    }
  };
  drain();
  receiver!.done.Store(true as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::method::singleThreadedWorkGroup.pop","kind":"method","status":"implemented","sigHash":"b4591f455dfbfc9dda4bf6bd450de895d37dc08301e65bf2298c34ac129d51ab","bodyHash":"0c6c6851e5da8b2d74873f7fa4cccd909e3189aedf69cf4fe1a3a7a2338cd81c"}
 *
 * Go source:
 * func (w *singleThreadedWorkGroup) pop() func() {
 * 	w.fnsMu.Lock()
 * 	defer w.fnsMu.Unlock()
 * 	if len(w.fns) == 0 {
 * 		return nil
 * 	}
 * 	end := len(w.fns) - 1
 * 	fn := w.fns[end]
 * 	w.fns[end] = nil // Allow GC
 * 	w.fns = w.fns[:end]
 * 	return fn
 * }
 */
export function singleThreadedWorkGroup_pop(receiver: GoPtr<singleThreadedWorkGroup>): GoPtr<() => void> {
  receiver!.fnsMu.Lock();
  if (receiver!.fns.length === 0) {
    receiver!.fnsMu.Unlock();
    return undefined;
  }
  const fn = receiver!.fns.pop()!;
  receiver!.fnsMu.Unlock();
  return fn;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::type::ThrottleGroup","kind":"type","status":"implemented","sigHash":"c2c7f843224565b8e12137b35657230a5ba972a5af6e4ec321733dd28a251f75","bodyHash":"d967d5238a014ad3f88864f018da20d67b101b09021f2af0dbac0b0c53e2eb1f"}
 *
 * Go source:
 * ThrottleGroup struct {
 * 	semaphore chan struct{}
 * 	group     *errgroup.Group
 * }
 */
export interface ThrottleGroup {
  semaphore: GoChan<{ readonly __tsgoEmpty?: never }, "bidirectional">;
  group: GoPtr<Group>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::func::NewThrottleGroup","kind":"func","status":"implemented","sigHash":"32e6223810b6d3463dcfe567e22200bc40e79eccece87bd67af3d32c688b880c","bodyHash":"ab422ce84d9bc036c2962029063de5ad974bff98bf8cda71d43d5ea79912d8df"}
 *
 * Go source:
 * func NewThrottleGroup(ctx context.Context, semaphore chan struct{}) *ThrottleGroup {
 * 	g, _ := errgroup.WithContext(ctx)
 * 	return &ThrottleGroup{
 * 		semaphore: semaphore,
 * 		group:     g,
 * 	}
 * }
 */
export function NewThrottleGroup(ctx: Context, semaphore: GoChan<{ readonly __tsgoEmpty?: never }, "bidirectional">): GoPtr<ThrottleGroup> {
  const [group] = WithContext(ctx);
  return {
    semaphore,
    group,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::method::ThrottleGroup.Go","kind":"method","status":"implemented","sigHash":"73f2fd187d8bfc7b8c568b33621ebac6f839fbfa338297906a95f3506bfeb1bd","bodyHash":"baccfb5231d0190a3b01f97e87979cd24b3afbad7b6bb3053af2fdfc7cc037af"}
 *
 * Go source:
 * func (tg *ThrottleGroup) Go(fn func() error) {
 * 	tg.group.Go(func() error {
 * 		// Acquire semaphore slot - this will block until a slot is available
 * 		tg.semaphore <- struct{}{}
 * 		defer func() {
 * 			// Release semaphore slot when done
 * 			<-tg.semaphore
 * 		}()
 * 		return fn()
 * 	})
 * }
 */
export function ThrottleGroup_Go(receiver: GoPtr<ThrottleGroup>, fn: () => GoError): void {
  // Single-threaded: semaphore and errgroup are no-ops; call fn synchronously.
  const err = fn();
  if (err !== undefined) {
    throw err;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::method::ThrottleGroup.Wait","kind":"method","status":"implemented","sigHash":"5509c7a6b09b2bbaf9be0e054349f985b78c62a5854a16c48a0ce0e63c78fbb2","bodyHash":"747addbdb10adfe1b1d0d6c5670e23b352b02f50f49df6c75111cdc6f3958148"}
 *
 * Go source:
 * func (tg *ThrottleGroup) Wait() error {
 * 	return tg.group.Wait()
 * }
 */
export function ThrottleGroup_Wait(receiver: GoPtr<ThrottleGroup>): GoError {
  return undefined;
}
