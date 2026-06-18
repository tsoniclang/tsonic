import * as nodeOs from "node:os";
export function Get() {
    const total = nodeOs.totalmem();
    const free = nodeOs.freemem();
    return [{
            Total: total,
            Used: (total - free),
            Cached: 0,
            Free: free,
        }, undefined];
}
//# sourceMappingURL=memory.js.map