import { WithContext } from "../../go/golang.org/x/sync/errgroup.js";
import { Mutex, WaitGroup } from "../../go/sync.js";
import { Bool } from "../../go/sync/atomic.js";
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
export function NewWorkGroup(singleThreaded) {
    if (singleThreaded) {
        const state = { done: new Bool(), fnsMu: new Mutex(), fns: [] };
        return singleThreadedWorkGroup_as_WorkGroup(state);
    }
    const state = { done: new Bool(), wg: new WaitGroup() };
    return parallelWorkGroup_as_WorkGroup(state);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"feba0cf005bcf5d6e05729801a7e3a0c2dec8c34bc116a37e80ba8b18b51086f"}
 *
 * Go source:
 * var _ WorkGroup = (*parallelWorkGroup)(nil)
 */
export const __7c9694b3_0 = parallelWorkGroup_as_WorkGroup(undefined);
export function parallelWorkGroup_as_WorkGroup(receiver) {
    return {
        Queue: (fn) => parallelWorkGroup_Queue(receiver, fn),
        RunAndWait: () => parallelWorkGroup_RunAndWait(receiver),
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
export function parallelWorkGroup_Queue(receiver, fn) {
    if (receiver.done.Load()) {
        throw new globalThis.Error("Queue called after RunAndWait returned");
    }
    receiver.wg.Go(fn);
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
export function parallelWorkGroup_RunAndWait(receiver) {
    receiver.wg.Wait(); // no-op single-threaded; all queued fns ran synchronously in Queue
    receiver.done.Store(true);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/workgroup.go::varGroup::_::#2","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"5da122d1ae9804f860a2993b32f9f119e31b623bfbe89928747ab96e1006479e"}
 *
 * Go source:
 * var _ WorkGroup = (*singleThreadedWorkGroup)(nil)
 */
export const __056fa025_0 = singleThreadedWorkGroup_as_WorkGroup(undefined);
export function singleThreadedWorkGroup_as_WorkGroup(receiver) {
    return {
        Queue: (fn) => singleThreadedWorkGroup_Queue(receiver, fn),
        RunAndWait: () => singleThreadedWorkGroup_RunAndWait(receiver),
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
export function singleThreadedWorkGroup_Queue(receiver, fn) {
    if (receiver.done.Load()) {
        throw new globalThis.Error("Queue called after RunAndWait returned");
    }
    receiver.fnsMu.Lock();
    receiver.fns.push(fn);
    receiver.fnsMu.Unlock();
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
export function singleThreadedWorkGroup_RunAndWait(receiver) {
    for (;;) {
        const fn = singleThreadedWorkGroup_pop(receiver);
        if (fn === undefined) {
            break;
        }
        fn();
    }
    receiver.done.Store(true);
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
export function singleThreadedWorkGroup_pop(receiver) {
    receiver.fnsMu.Lock();
    if (receiver.fns.length === 0) {
        receiver.fnsMu.Unlock();
        return undefined;
    }
    const fn = receiver.fns.pop();
    receiver.fnsMu.Unlock();
    return fn;
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
export function NewThrottleGroup(ctx, semaphore) {
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
export function ThrottleGroup_Go(receiver, fn) {
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
export function ThrottleGroup_Wait(receiver) {
    return undefined;
}
//# sourceMappingURL=workgroup.js.map