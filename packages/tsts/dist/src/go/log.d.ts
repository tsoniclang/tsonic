import type { int } from "@tsonic/core/types.js";
export declare const Ldate: int;
export declare const Ltime: int;
export declare const Lmicroseconds: int;
export declare const Llongfile: int;
export declare const Lshortfile: int;
export declare const LUTC: int;
export declare const Lmsgprefix: int;
export declare const LstdFlags: int;
export declare function SetFlags(nextFlags: int): void;
export declare function Flags(): int;
export declare function Printf(format: string, ...args: unknown[]): void;
export declare function Fatalf(format: string, ...args: unknown[]): never;
//# sourceMappingURL=log.d.ts.map