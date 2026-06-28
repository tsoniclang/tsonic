import { Canceled } from "../context.js";
class signalContext {
    parent;
    canceled = false;
    constructor(parent) {
        this.parent = parent;
    }
    cancel() {
        this.canceled = true;
    }
    Deadline() {
        return this.parent.Deadline();
    }
    Done() {
        return undefined;
    }
    Err() {
        return this.canceled ? Canceled : this.parent.Err();
    }
    Value(key) {
        return this.parent.Value(key);
    }
}
export function NotifyContext(parent, ...signals) {
    const context = new signalContext(parent);
    const handlers = signals.map((signal) => {
        const handler = () => context.cancel();
        process.once(signal, handler);
        return { signal: signal, handler };
    });
    const stop = () => {
        context.cancel();
        for (const entry of handlers) {
            process.off(entry.signal, entry.handler);
        }
    };
    return [context, stop];
}
//# sourceMappingURL=signal.js.map