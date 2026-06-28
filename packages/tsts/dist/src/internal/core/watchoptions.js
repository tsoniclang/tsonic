/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::constGroup::WatchFileKindNone+WatchFileKindFixedPollingInterval+WatchFileKindPriorityPollingInterval+WatchFileKindDynamicPriorityPolling+WatchFileKindFixedChunkSizePolling+WatchFileKindUseFsEvents+WatchFileKindUseFsEventsOnParentDirectory","kind":"constGroup","status":"implemented","sigHash":"88919dbd92a1436a48f19d14e8f31070d0f6c2d87430982db8a59e1ec723cad5","bodyHash":"8d94ca11677734ab7240a52af7094366f1861d1e15bc6ec578e8fc3e0f93be06"}
 *
 * Go source:
 * const (
 * 	WatchFileKindNone                         WatchFileKind = 0
 * 	WatchFileKindFixedPollingInterval         WatchFileKind = 1
 * 	WatchFileKindPriorityPollingInterval      WatchFileKind = 2
 * 	WatchFileKindDynamicPriorityPolling       WatchFileKind = 3
 * 	WatchFileKindFixedChunkSizePolling        WatchFileKind = 4
 * 	WatchFileKindUseFsEvents                  WatchFileKind = 5
 * 	WatchFileKindUseFsEventsOnParentDirectory WatchFileKind = 6
 * )
 */
export const WatchFileKindNone = 0;
export const WatchFileKindFixedPollingInterval = 1;
export const WatchFileKindPriorityPollingInterval = 2;
export const WatchFileKindDynamicPriorityPolling = 3;
export const WatchFileKindFixedChunkSizePolling = 4;
export const WatchFileKindUseFsEvents = 5;
export const WatchFileKindUseFsEventsOnParentDirectory = 6;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::constGroup::WatchDirectoryKindNone+WatchDirectoryKindUseFsEvents+WatchDirectoryKindFixedPollingInterval+WatchDirectoryKindDynamicPriorityPolling+WatchDirectoryKindFixedChunkSizePolling","kind":"constGroup","status":"implemented","sigHash":"51dc1fb98e97e2bb4137d76ca6a8ef702399ce91bf99cb7579d2d40d0e057f9a","bodyHash":"655c5bdb43b1864d477a34909bc1676de64bf1338922e512bdaa8e7019c781cb"}
 *
 * Go source:
 * const (
 * 	WatchDirectoryKindNone                   WatchDirectoryKind = 0
 * 	WatchDirectoryKindUseFsEvents            WatchDirectoryKind = 1
 * 	WatchDirectoryKindFixedPollingInterval   WatchDirectoryKind = 2
 * 	WatchDirectoryKindDynamicPriorityPolling WatchDirectoryKind = 3
 * 	WatchDirectoryKindFixedChunkSizePolling  WatchDirectoryKind = 4
 * )
 */
export const WatchDirectoryKindNone = 0;
export const WatchDirectoryKindUseFsEvents = 1;
export const WatchDirectoryKindFixedPollingInterval = 2;
export const WatchDirectoryKindDynamicPriorityPolling = 3;
export const WatchDirectoryKindFixedChunkSizePolling = 4;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::constGroup::PollingKindNone+PollingKindFixedInterval+PollingKindPriorityInterval+PollingKindDynamicPriority+PollingKindFixedChunkSize","kind":"constGroup","status":"implemented","sigHash":"360d7b8b7fe466208028b79274c2e0b43ed4fe18eaf41916444b750f0ccfbd06","bodyHash":"fbc688d4a0b819f76251a975706f7ded103820a07078c4b44044fe694188dbb0"}
 *
 * Go source:
 * const (
 * 	PollingKindNone             PollingKind = 0
 * 	PollingKindFixedInterval    PollingKind = 1
 * 	PollingKindPriorityInterval PollingKind = 2
 * 	PollingKindDynamicPriority  PollingKind = 3
 * 	PollingKindFixedChunkSize   PollingKind = 4
 * )
 */
export const PollingKindNone = 0;
export const PollingKindFixedInterval = 1;
export const PollingKindPriorityInterval = 2;
export const PollingKindDynamicPriority = 3;
export const PollingKindFixedChunkSize = 4;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::method::WatchOptions.WatchInterval","kind":"method","status":"implemented","sigHash":"844ee5f41c0b2b975b26c0b38fe1aeb4bf7a438c68a01c0e8753d988710ef38f","bodyHash":"f6ef965658f88f2982011d4cbafb874ba4d432f169a02509ae535e74c3fb3995"}
 *
 * Go source:
 * func (w *WatchOptions) WatchInterval() time.Duration {
 * 	watchInterval := 2000 * time.Millisecond
 * 	if w != nil && w.Interval != nil {
 * 		watchInterval = time.Duration(*w.Interval) * time.Millisecond
 * 	}
 * 	return watchInterval
 * }
 */
export function WatchOptions_WatchInterval(receiver) {
    // time.Millisecond = 1_000_000 nanoseconds; Duration = long (nanoseconds).
    const millisecond = 1_000_000;
    const defaultInterval = (2000 * millisecond);
    if (receiver !== undefined && receiver.Interval !== undefined) {
        return (receiver.Interval * millisecond);
    }
    return defaultInterval;
}
//# sourceMappingURL=watchoptions.js.map