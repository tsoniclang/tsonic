import type { GoError } from "../compat.js";
export declare class URL {
    private readonly value;
    constructor(value: globalThis.URL);
    String(): string;
    Path(): string;
    RawQuery(): string;
}
export declare function Parse(rawURL: string): [URL | undefined, GoError];
export declare function PathEscape(s: string): string;
export declare function QueryEscape(s: string): string;
export declare function QueryUnescape(s: string): [string, GoError];
//# sourceMappingURL=url.d.ts.map