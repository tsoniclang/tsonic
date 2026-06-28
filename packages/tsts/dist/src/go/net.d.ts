import type { GoError } from "./compat.js";
import * as nodeNet from "node:net";
export interface Addr {
    Network(): string;
    String(): string;
}
export interface Listener {
    Accept(): [nodeNet.Socket | undefined, GoError];
    Close(): GoError;
    Addr(): Addr;
}
export declare function Listen(network: string, address: string): [Listener | undefined, GoError];
//# sourceMappingURL=net.d.ts.map