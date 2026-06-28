import type { bool, long } from "../../go/scalars.js";
import type { GoComparable, GoPtr, GoSlice } from "../../go/compat.js";
import type { Int64 } from "../../go/sync/atomic.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import type { SyncSet } from "../collections/syncset.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::type::BreadthFirstSearchResult","kind":"type","status":"implemented","sigHash":"983db95743f083de914f46fe0f414fcaaeedb3c83b8b8885774e02abb1a1bf77","bodyHash":"309ebf85a8e1d1c8b853258caf629d5709d4c50933b4039bb5709ae637129405"}
 *
 * Go source:
 * BreadthFirstSearchResult[N any] struct {
 * 	Stopped bool
 * 	Path    []N
 * }
 */
export interface BreadthFirstSearchResult<N = unknown> {
    Stopped: bool;
    Path: GoSlice<N>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::type::breadthFirstSearchJob","kind":"type","status":"implemented","sigHash":"900d3ea72d81eff4d282136ee7be57d7f3c1f0133de55c97ec34289122f2fb3f","bodyHash":"f0da07afc98877f6240059d69dfe598fa60915bb6c289148b826d3889520963b"}
 *
 * Go source:
 * breadthFirstSearchJob[N any] struct {
 * 	node   N
 * 	parent *breadthFirstSearchJob[N]
 * }
 */
export interface breadthFirstSearchJob<N = unknown> {
    node: N;
    parent: GoPtr<breadthFirstSearchJob<N>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::type::BreadthFirstSearchLevel","kind":"type","status":"implemented","sigHash":"387c8702c2c347620608b7a95eca74cf5550c85a8ec43ce5715156a2af2d3cbf","bodyHash":"4d6020eade6f6fb22ab1a48bd8be2fa8aa4697e64652c58bafb9dbe58c8e468a"}
 *
 * Go source:
 * BreadthFirstSearchLevel[K comparable, N any] struct {
 * 	jobs *collections.OrderedMap[K, *breadthFirstSearchJob[N]]
 * }
 */
export interface BreadthFirstSearchLevel<K extends GoComparable = unknown, N = unknown> {
    jobs: GoPtr<OrderedMap<K, GoPtr<breadthFirstSearchJob<N>>>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::method::BreadthFirstSearchLevel.Has","kind":"method","status":"implemented","sigHash":"5857ea09874f91052733e5b927486b7507b8da64e5921cd0c25e881b52ed3eae","bodyHash":"7f7adb476ffc0dd66088caf36e8f33f3c6dac0a15845a6cfa0005020e22fc1c7"}
 *
 * Go source:
 * func (l *BreadthFirstSearchLevel[K, N]) Has(key K) bool {
 * 	return l.jobs.Has(key)
 * }
 */
export declare function BreadthFirstSearchLevel_Has<K extends GoComparable, N>(receiver: GoPtr<BreadthFirstSearchLevel<K, N>>, key: K): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::method::BreadthFirstSearchLevel.Delete","kind":"method","status":"implemented","sigHash":"dea852faac43ca3117e2ec79c62db799b6c9fcd3ecfb7de84a73dfb7b233c3d3","bodyHash":"c100825d0c017408e81a325663ee547f1317b196ba2d44975490b78658ea02cf"}
 *
 * Go source:
 * func (l *BreadthFirstSearchLevel[K, N]) Delete(key K) {
 * 	l.jobs.Delete(key)
 * }
 */
export declare function BreadthFirstSearchLevel_Delete<K extends GoComparable, N>(receiver: GoPtr<BreadthFirstSearchLevel<K, N>>, key: K): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::method::BreadthFirstSearchLevel.Range","kind":"method","status":"implemented","sigHash":"0fe2247b8aceb5334ec20275f40e404a98fa9b96151482d918555c617b5364a3","bodyHash":"2b805bc18ab91850800f1ff67f2c70749b76c20d177b21f3c92550d36274f864"}
 *
 * Go source:
 * func (l *BreadthFirstSearchLevel[K, N]) Range(f func(node N) bool) {
 * 	for job := range l.jobs.Values() {
 * 		if !f(job.node) {
 * 			return
 * 		}
 * 	}
 * }
 */
export declare function BreadthFirstSearchLevel_Range<K extends GoComparable, N>(receiver: GoPtr<BreadthFirstSearchLevel<K, N>>, f: (node: N) => bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::type::BreadthFirstSearchOptions","kind":"type","status":"implemented","sigHash":"91a7347549071365c6ba2393774a4e83adc0d20fe99d1b565b4af3f2f0295cd3","bodyHash":"066ea2ecb621538ab6760b097ea7273a673a7e227abd8744a3ea433dc29bb262"}
 *
 * Go source:
 * BreadthFirstSearchOptions[K comparable, N any] struct {
 * 	// Visited is a set of nodes that have already been visited.
 * 	// If nil, a new set will be created.
 * 	Visited *collections.SyncSet[K]
 * 	// PreprocessLevel is a function that, if provided, will be called
 * 	// before each level, giving the caller an opportunity to remove nodes.
 * 	PreprocessLevel func(*BreadthFirstSearchLevel[K, N])
 * }
 */
export interface BreadthFirstSearchOptions<K extends GoComparable = unknown, N = unknown> {
    Visited: GoPtr<SyncSet<K>>;
    PreprocessLevel: (arg0: GoPtr<BreadthFirstSearchLevel<K, N>>) => void;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::func::BreadthFirstSearchParallel","kind":"func","status":"implemented","sigHash":"5b479e33bd171b6ba49da3f144e952a82e69fe245d13aa2e9b148836b846669a","bodyHash":"4bc5bba5c12ff44aaa3e8697d6b3cf79194af914e1ff5a8a6cf79f37279c6cd7"}
 *
 * Go source:
 * func BreadthFirstSearchParallel[N comparable](
 * 	start N,
 * 	neighbors func(N) []N,
 * 	visit func(node N) (isResult bool, stop bool),
 * ) BreadthFirstSearchResult[N] {
 * 	return BreadthFirstSearchParallelEx(start, neighbors, visit, BreadthFirstSearchOptions[N, N]{}, Identity)
 * }
 */
export declare function BreadthFirstSearchParallel<N extends GoComparable>(start: N, neighbors: (arg0: N) => GoSlice<N>, visit: (node: N) => [bool, bool]): BreadthFirstSearchResult<N>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::func::BreadthFirstSearchParallelEx","kind":"func","status":"implemented","sigHash":"89e6ce09eedbf0d5603510cbecb3482eb5e8b1ea6807e890e060d8d756668705","bodyHash":"2ce499b01553903ae4f70fea7c871e70ec82d58ff3d387a29b8127e2ef04802b"}
 *
 * Go source:
 * func BreadthFirstSearchParallelEx[K comparable, N any](
 * 	start N,
 * 	neighbors func(N) []N,
 * 	visit func(node N) (isResult bool, stop bool),
 * 	options BreadthFirstSearchOptions[K, N],
 * 	getKey func(N) K,
 * ) BreadthFirstSearchResult[N] { ... }
 */
export declare function BreadthFirstSearchParallelEx<K extends GoComparable, N>(start: N, neighbors: (arg0: N) => GoSlice<N>, visit: (node: N) => [bool, bool], options: BreadthFirstSearchOptions<K, N>, getKey: (arg0: N) => K): BreadthFirstSearchResult<N>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::func::updateMin","kind":"func","status":"implemented","sigHash":"a1b2637575bcb5696071184397f20fc795af9e66838483adc563139d453ac491","bodyHash":"632e1f35bed1a54b29efbf856074d64d39224c5f18a753f421554f235038062d"}
 *
 * Go source:
 * func updateMin(a *atomic.Int64, candidate int64) bool {
 * 	for {
 * 		current := a.Load()
 * 		if current < candidate {
 * 			return false
 * 		}
 * 		if a.CompareAndSwap(current, candidate) {
 * 			return true
 * 		}
 * 	}
 * }
 */
export declare function updateMin(a: GoPtr<Int64>, candidate: long): bool;
//# sourceMappingURL=bfs.d.ts.map