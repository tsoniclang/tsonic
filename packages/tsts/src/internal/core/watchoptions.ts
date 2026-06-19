import type { int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Duration } from "../../go/time.js";
import type { Tristate } from "./tristate.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::type::WatchOptions","kind":"type","status":"implemented","sigHash":"cb0c0f5cde73c40bd392764df9c11a6c64cdb45186a668c0f7fbc7899c3d5c07","bodyHash":"878872bc263824b9d8ed38d79fa2fd5300d8036cdd21656a3238122d128c2e3e"}
 *
 * Go source:
 * WatchOptions struct {
 * 	Interval        *int               `json:"watchInterval"`
 * 	FileKind        WatchFileKind      `json:"watchFile"`
 * 	DirectoryKind   WatchDirectoryKind `json:"watchDirectory"`
 * 	FallbackPolling PollingKind        `json:"fallbackPolling"`
 * 	SyncWatchDir    Tristate           `json:"synchronousWatchDirectory"`
 * 	ExcludeDir      []string           `json:"excludeDirectories"`
 * 	ExcludeFiles    []string           `json:"excludeFiles"`
 * }
 */
export interface WatchOptions {
  Interval: GoPtr<int>;
  FileKind: WatchFileKind;
  DirectoryKind: WatchDirectoryKind;
  FallbackPolling: PollingKind;
  SyncWatchDir: Tristate;
  ExcludeDir: GoSlice<string>;
  ExcludeFiles: GoSlice<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::type::WatchFileKind","kind":"type","status":"implemented","sigHash":"27b5bcc61523b22c128da14de2ffc6338679d8776c9c1d5ab560d0d71c6bfbb6","bodyHash":"5671fb516878da4b72087729ceac403fec9dccefa4be16c20f523790162824c7"}
 *
 * Go source:
 * WatchFileKind int32
 */
export type WatchFileKind = int;

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
export const WatchFileKindNone: WatchFileKind = 0;
export const WatchFileKindFixedPollingInterval: WatchFileKind = 1;
export const WatchFileKindPriorityPollingInterval: WatchFileKind = 2;
export const WatchFileKindDynamicPriorityPolling: WatchFileKind = 3;
export const WatchFileKindFixedChunkSizePolling: WatchFileKind = 4;
export const WatchFileKindUseFsEvents: WatchFileKind = 5;
export const WatchFileKindUseFsEventsOnParentDirectory: WatchFileKind = 6;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::type::WatchDirectoryKind","kind":"type","status":"implemented","sigHash":"fea8f8eafde71eb6a1807f74c4b8727ae838c4520bfff6a9eab0911ae13c3ca8","bodyHash":"aca9bd0301be74682f2002b0e23db631c5a2f80ded7ed202511d18e862f65d70"}
 *
 * Go source:
 * WatchDirectoryKind int32
 */
export type WatchDirectoryKind = int;

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
export const WatchDirectoryKindNone: WatchDirectoryKind = 0;
export const WatchDirectoryKindUseFsEvents: WatchDirectoryKind = 1;
export const WatchDirectoryKindFixedPollingInterval: WatchDirectoryKind = 2;
export const WatchDirectoryKindDynamicPriorityPolling: WatchDirectoryKind = 3;
export const WatchDirectoryKindFixedChunkSizePolling: WatchDirectoryKind = 4;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/watchoptions.go::type::PollingKind","kind":"type","status":"implemented","sigHash":"64dd816208c93fe4e1bf05f567b47dd427911297c1f5e93c7e3d7afe358a4f77","bodyHash":"36a1f69d9a2f294d0393a0c93438c39afc313a986d6f26141692da0ce32de3ec"}
 *
 * Go source:
 * PollingKind int32
 */
export type PollingKind = int;

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
export const PollingKindNone: PollingKind = 0;
export const PollingKindFixedInterval: PollingKind = 1;
export const PollingKindPriorityInterval: PollingKind = 2;
export const PollingKindDynamicPriority: PollingKind = 3;
export const PollingKindFixedChunkSize: PollingKind = 4;

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
export function WatchOptions_WatchInterval(receiver: GoPtr<WatchOptions>): Duration {
  // time.Millisecond = 1_000_000 nanoseconds; Duration = long (nanoseconds).
  const millisecond: Duration = 1_000_000 as Duration;
  const defaultInterval: Duration = (2000 * (millisecond as number)) as Duration;
  if (receiver !== undefined && receiver.Interval !== undefined) {
    return ((receiver.Interval as number) * (millisecond as number)) as Duration;
  }
  return defaultInterval;
}
