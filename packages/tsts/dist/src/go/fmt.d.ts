import type { byte, int } from "./scalars.js";
import type { GoError, GoSlice } from "./compat.js";
export interface Stringer {
    String(): string;
}
interface Writer {
    Write(p: GoSlice<byte>): [int, GoError];
}
export declare function Sprintf(format: string, ...args: unknown[]): string;
export declare function Errorf(format: string, ...args: unknown[]): GoError;
export declare function Sprint(...args: unknown[]): string;
export declare function Sprintln(...args: unknown[]): string;
export declare function Println(...args: unknown[]): [int, GoError];
export declare function Fprint(w: Writer, ...args: unknown[]): [int, GoError];
export declare function Fprintf(w: Writer, format: string, ...args: unknown[]): [int, GoError];
export declare function Fprintln(w: Writer, ...args: unknown[]): [int, GoError];
export interface ScanTarget {
    set(value: unknown): void;
}
export declare function Sscanf(str: string, format: string, ...targets: ScanTarget[]): [int, GoError];
export {};
//# sourceMappingURL=fmt.d.ts.map