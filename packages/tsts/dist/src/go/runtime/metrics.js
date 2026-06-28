import * as nodeOs from "node:os";
export const KindBad = 0;
export const KindUint64 = 1;
export const KindFloat64 = 2;
export const KindFloat64Histogram = 3;
export class Value {
    kind;
    payload;
    constructor(kind, payload) {
        this.kind = kind;
        this.payload = payload;
    }
    static Uint64(value) {
        return new Value(KindUint64, value);
    }
    static Float64(value) {
        return new Value(KindFloat64, value);
    }
    static Histogram(value) {
        return new Value(KindFloat64Histogram, value);
    }
    Kind() {
        return this.kind;
    }
    Uint64() {
        return (this.kind === KindUint64 ? this.payload : 0);
    }
    Float64() {
        return this.kind === KindFloat64 ? this.payload : 0;
    }
    Float64Histogram() {
        return this.kind === KindFloat64Histogram ? this.payload : undefined;
    }
}
export function All() {
    return [
        {
            Name: "/memory/classes/heap/free:bytes",
            Description: "Approximate free system memory in bytes.",
            Kind: KindUint64,
            Cumulative: false,
        },
        {
            Name: "/memory/classes/total:bytes",
            Description: "Approximate total system memory in bytes.",
            Kind: KindUint64,
            Cumulative: false,
        },
        {
            Name: "/sched/goroutines:goroutines",
            Description: "Single-threaded JavaScript runtime goroutine count.",
            Kind: KindUint64,
            Cumulative: false,
        },
    ];
}
export function Read(samples) {
    for (const sample of samples) {
        switch (sample.Name) {
            case "/memory/classes/heap/free:bytes":
                sample.Value = Value.Uint64(nodeOs.freemem());
                break;
            case "/memory/classes/total:bytes":
                sample.Value = Value.Uint64(nodeOs.totalmem());
                break;
            case "/sched/goroutines:goroutines":
                sample.Value = Value.Uint64(1);
                break;
            default:
                sample.Value = Value.Uint64(0);
                break;
        }
    }
}
//# sourceMappingURL=metrics.js.map