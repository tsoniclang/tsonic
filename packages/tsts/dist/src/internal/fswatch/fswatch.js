import * as errors from "../../go/errors.js";
export const EventUpdate = 1;
export const EventDelete = 2;
// EventKind.String renders the kind for diagnostics.
export function EventKind_String(k) {
    switch (k) {
        case EventUpdate:
            return "update";
        case EventDelete:
            return "delete";
        default:
            return "unknown";
    }
}
// --- watcher.go ---
// Sentinel errors. Callers test these with errors.Is; ErrOverflow is
// recoverable (forces a full rescan) and ErrWatchTerminated is terminal.
export const ErrOverflow = errors.New("fswatch: event overflow; some changes were missed");
export const ErrWatchTerminated = errors.New("fswatch: watch terminated");
export const ErrUnavailable = errors.New("fswatch: watcher not available on this platform");
// WithIgnore returns a WatchOption that drops events for paths where fn returns
// true.
export function WithIgnore(fn) {
    return { ignore: fn };
}
// WithRecursive returns a WatchOption that watches the entire directory tree
// rather than only direct children.
export function WithRecursive() {
    return { recursive: true };
}
const TSGO_FSWATCH_UNIMPLEMENTED = "TSGO_EXTERNAL_FACADE_UNIMPLEMENTED internal/fswatch host backend (watch mode is not supported in the TSTS host)";
// hostWatcher is the host stub. The introspection methods return inert values so
// non-watch setup paths (e.g. debug-logging the backend name) do not fault; the
// actual watch operations throw, since TSTS provides no OS file watching.
class hostWatcher {
    Name() {
        return "host";
    }
    Available() {
        return false;
    }
    HasFastRecursiveBackend() {
        return false;
    }
    WatchDirectory(dir, fn, ...opts) {
        throw new globalThis.Error(TSGO_FSWATCH_UNIMPLEMENTED);
    }
    WatchFile(path, fn) {
        throw new globalThis.Error(TSGO_FSWATCH_UNIMPLEMENTED);
    }
}
// Default returns the recommended watcher for the current OS. In the TSTS host
// this is the unimplemented stub.
export function Default() {
    return new hostWatcher();
}
//# sourceMappingURL=fswatch.js.map