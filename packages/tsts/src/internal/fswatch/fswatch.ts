import type { bool, int } from "../../go/scalars.js";
import type { GoError, GoSlice } from "../../go/compat.js";
import type { Closer } from "../../go/io.js";
import * as errors from "../../go/errors.js";

// Host-native facade for the upstream internal/fswatch package — the vendored
// fsnotify fork (fanotify / FSEvents / kqueue / inotify / ReadDirectoryChangesW,
// ~270 units) that replaced internal/vfs/vfswatch upstream. TSTS does not port
// the OS-level watch internals; file watching is a host concern. This module
// exposes only the public surface that internal/execute/watcher consumes, with
// a host stub whose watch operations throw TSGO_EXTERNAL_FACADE_UNIMPLEMENTED.
// Watch mode is therefore unsupported in the TSTS host until a real Node-backed
// backend is provided. Classified host-native in porter.config.json; not
// porter-unit-tracked (no @tsgo-unit headers).

// --- event.go ---

// EventKind classifies a filesystem change.
export type EventKind = int;
export const EventUpdate: EventKind = 1;
export const EventDelete: EventKind = 2;

// EventKind.String renders the kind for diagnostics.
export function EventKind_String(k: EventKind): string {
  switch (k) {
    case EventUpdate:
      return "update";
    case EventDelete:
      return "delete";
    default:
      return "unknown";
  }
}

// Event describes a single filesystem change.
export interface Event {
  Kind: EventKind;
  Path: string;
}

// --- watcher.go ---

// Sentinel errors. Callers test these with errors.Is; ErrOverflow is
// recoverable (forces a full rescan) and ErrWatchTerminated is terminal.
export const ErrOverflow: GoError = errors.New("fswatch: event overflow; some changes were missed");
export const ErrWatchTerminated: GoError = errors.New("fswatch: watch terminated");
export const ErrUnavailable: GoError = errors.New("fswatch: watcher not available on this platform");

// WatchCallback receives batched filesystem events. When err is non-nil,
// callers use errors.Is to check for ErrOverflow / ErrWatchTerminated.
export type WatchCallback = (events: GoSlice<Event>, err: GoError) => void;

// WatchOption configures a watch. WithRecursive enables whole-tree watching;
// WithIgnore filters events before delivery. The host stub never applies them.
export interface WatchOption {
  readonly recursive?: bool;
  readonly ignore?: (path: string) => bool;
}

// WithIgnore returns a WatchOption that drops events for paths where fn returns
// true.
export function WithIgnore(fn: (path: string) => bool): WatchOption {
  return { ignore: fn };
}

// WithRecursive returns a WatchOption that watches the entire directory tree
// rather than only direct children.
export function WithRecursive(): WatchOption {
  return { recursive: true as bool };
}

// Watch represents a live watch; Close stops watching and is idempotent. It is
// an io.Closer.
export interface Watch extends Closer {
  readonly __tsgoEmpty?: never;
}

// Watcher is a platform file-watcher backend. The execute watcher only consumes
// Name and WatchDirectory; the remaining methods complete the upstream surface.
export interface Watcher {
  Name(): string;
  Available(): bool;
  HasFastRecursiveBackend(): bool;
  WatchDirectory(dir: string, fn: WatchCallback, ...opts: GoSlice<WatchOption>): [Watch, GoError];
  WatchFile(path: string, fn: WatchCallback): [Watch, GoError];
}

const TSGO_FSWATCH_UNIMPLEMENTED =
  "TSGO_EXTERNAL_FACADE_UNIMPLEMENTED internal/fswatch host backend (watch mode is not supported in the TSTS host)";

// hostWatcher is the host stub. The introspection methods return inert values so
// non-watch setup paths (e.g. debug-logging the backend name) do not fault; the
// actual watch operations throw, since TSTS provides no OS file watching.
class hostWatcher implements Watcher {
  Name(): string {
    return "host";
  }
  Available(): bool {
    return false as bool;
  }
  HasFastRecursiveBackend(): bool {
    return false as bool;
  }
  WatchDirectory(dir: string, fn: WatchCallback, ...opts: GoSlice<WatchOption>): [Watch, GoError] {
    throw new globalThis.Error(TSGO_FSWATCH_UNIMPLEMENTED);
  }
  WatchFile(path: string, fn: WatchCallback): [Watch, GoError] {
    throw new globalThis.Error(TSGO_FSWATCH_UNIMPLEMENTED);
  }
}

// Default returns the recommended watcher for the current OS. In the TSTS host
// this is the unimplemented stub.
export function Default(): Watcher {
  return new hostWatcher();
}
