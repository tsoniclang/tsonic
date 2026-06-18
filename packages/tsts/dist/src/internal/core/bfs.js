import { OrderedMap_Delete, OrderedMap_EntryAt, OrderedMap_Has, OrderedMap_Set, OrderedMap_Size, OrderedMap_Values } from "../collections/ordered_map.js";
import { NewOrderedMapFromList, NewOrderedMapWithSizeHint } from "../collections/ordered_map.js";
import { SyncSet_AddIfAbsent } from "../collections/syncset.js";
import { Map } from "./core.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::method::BreadthFirstSearchLevel.Has","kind":"method","status":"implemented","sigHash":"5857ea09874f91052733e5b927486b7507b8da64e5921cd0c25e881b52ed3eae","bodyHash":"7f7adb476ffc0dd66088caf36e8f33f3c6dac0a15845a6cfa0005020e22fc1c7"}
 *
 * Go source:
 * func (l *BreadthFirstSearchLevel[K, N]) Has(key K) bool {
 * 	return l.jobs.Has(key)
 * }
 */
export function BreadthFirstSearchLevel_Has(receiver, key) {
    return OrderedMap_Has(receiver.jobs, key);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/bfs.go::method::BreadthFirstSearchLevel.Delete","kind":"method","status":"implemented","sigHash":"dea852faac43ca3117e2ec79c62db799b6c9fcd3ecfb7de84a73dfb7b233c3d3","bodyHash":"c100825d0c017408e81a325663ee547f1317b196ba2d44975490b78658ea02cf"}
 *
 * Go source:
 * func (l *BreadthFirstSearchLevel[K, N]) Delete(key K) {
 * 	l.jobs.Delete(key)
 * }
 */
export function BreadthFirstSearchLevel_Delete(receiver, key) {
    OrderedMap_Delete(receiver.jobs, key);
}
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
export function BreadthFirstSearchLevel_Range(receiver, f) {
    OrderedMap_Values(receiver.jobs)((job) => {
        if (!f(job.node)) {
            return false;
        }
        return true;
    });
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
export function BreadthFirstSearchParallel(start, neighbors, visit) {
    return BreadthFirstSearchParallelEx(start, neighbors, visit, {}, (n) => n);
}
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
export function BreadthFirstSearchParallelEx(start, neighbors, visit, options, getKey) {
    let visited = options.Visited;
    if (visited === undefined) {
        visited = { set: new globalThis.Set() };
    }
    let fallback = undefined;
    // processLevel processes each node at the current level sequentially.
    const processLevel = (index, jobs) => {
        let lowestFallback = Number.MAX_SAFE_INTEGER;
        let lowestGoal = Number.MAX_SAFE_INTEGER;
        let nextJobCount = 0;
        if (options.PreprocessLevel !== undefined) {
            options.PreprocessLevel({ jobs: jobs });
        }
        const next = new globalThis.Array(OrderedMap_Size(jobs)).fill([]);
        let i = 0;
        OrderedMap_Values(jobs)((j) => {
            const curI = i;
            i++;
            if (curI >= lowestGoal) {
                return true; // continue iteration
            }
            // If we have already visited this node, skip it.
            if (!SyncSet_AddIfAbsent(visited, getKey(j.node))) {
                return true;
            }
            const [isResult, stop] = visit(j.node);
            if (isResult) {
                if (stop) {
                    if (curI < lowestGoal) {
                        lowestGoal = curI;
                    }
                    return true;
                }
                if (fallback === undefined) {
                    if (curI < lowestFallback) {
                        lowestFallback = curI;
                    }
                }
            }
            if (curI >= lowestGoal) {
                return true;
            }
            // Add the next level jobs
            const neighborNodes = neighbors(j.node);
            if (neighborNodes.length > 0) {
                nextJobCount += neighborNodes.length;
                next[curI] = Map(neighborNodes, (child) => {
                    return { node: child, parent: j };
                });
            }
            return true;
        });
        if (lowestGoal !== Number.MAX_SAFE_INTEGER) {
            const [, job] = OrderedMap_EntryAt(jobs, lowestGoal);
            return { stop: true, job: job, next: undefined };
        }
        if (fallback === undefined) {
            if (lowestFallback !== Number.MAX_SAFE_INTEGER) {
                const [, fb] = OrderedMap_EntryAt(jobs, lowestFallback);
                fallback = fb;
            }
        }
        const nextJobs = NewOrderedMapWithSizeHint(nextJobCount);
        for (const jobList of next) {
            for (const j of jobList) {
                if (!OrderedMap_Has(nextJobs, getKey(j.node))) {
                    OrderedMap_Set(nextJobs, getKey(j.node), j);
                }
            }
        }
        return { stop: false, job: undefined, next: nextJobs };
    };
    const createPath = (job) => {
        const path = [];
        let cur = job;
        while (cur !== undefined) {
            path.push(cur.node);
            cur = cur.parent;
        }
        return path;
    };
    let levelIndex = 0;
    let level = NewOrderedMapFromList([
        { Key: getKey(start), Value: { node: start, parent: undefined } },
    ]);
    while (OrderedMap_Size(level) > 0) {
        const r = processLevel(levelIndex, level);
        if (r.stop) {
            return { Stopped: true, Path: createPath(r.job) };
        }
        else if (r.job !== undefined && fallback === undefined) {
            fallback = r.job;
        }
        level = r.next;
        levelIndex++;
    }
    return { Stopped: false, Path: createPath(fallback) };
}
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
export function updateMin(a, candidate) {
    // Single-threaded: no real CAS spin needed. Load current, update if candidate
    // is strictly smaller, and return whether the update happened.
    const current = a.Load();
    if (current < candidate) {
        return false;
    }
    a.Store(candidate);
    return true;
}
//# sourceMappingURL=bfs.js.map