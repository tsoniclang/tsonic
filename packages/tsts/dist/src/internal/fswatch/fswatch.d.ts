import type { bool, int } from "../../go/scalars.js";
import type { GoError, GoSlice } from "../../go/compat.js";
import type { Closer } from "../../go/io.js";
export type EventKind = int;
export declare const EventUpdate: EventKind;
export declare const EventDelete: EventKind;
export declare function EventKind_String(k: EventKind): string;
export interface Event {
    Kind: EventKind;
    Path: string;
}
export declare const ErrOverflow: GoError;
export declare const ErrWatchTerminated: GoError;
export declare const ErrUnavailable: GoError;
export type WatchCallback = (events: GoSlice<Event>, err: GoError) => void;
export interface WatchOption {
    readonly recursive?: bool;
    readonly ignore?: (path: string) => bool;
}
export declare function WithIgnore(fn: (path: string) => bool): WatchOption;
export declare function WithRecursive(): WatchOption;
export interface Watch extends Closer {
    readonly __tsgoEmpty?: never;
}
export interface Watcher {
    Name(): string;
    Available(): bool;
    HasFastRecursiveBackend(): bool;
    WatchDirectory(dir: string, fn: WatchCallback, ...opts: GoSlice<WatchOption>): [Watch, GoError];
    WatchFile(path: string, fn: WatchCallback): [Watch, GoError];
}
export declare function Default(): Watcher;
//# sourceMappingURL=fswatch.d.ts.map