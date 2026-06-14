import type { GoError } from "../compat.js";
import type { Reader } from "../io.js";
export declare class Decoder {
    private readonly source;
    constructor(source: Reader | string | Uint8Array);
    Decode(target: {
        value?: string;
    } | undefined): GoError;
}
export declare function NewDecoder(source: Reader | string | Uint8Array): Decoder;
//# sourceMappingURL=xml.d.ts.map