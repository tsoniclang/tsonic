export class Group {
    err;
    Go(fn) {
        if (this.err !== undefined) {
            return;
        }
        const err = fn();
        if (err !== undefined) {
            this.err = err;
        }
    }
    Wait() {
        return this.err;
    }
}
export function WithContext(ctx) {
    return [new Group(), ctx];
}
//# sourceMappingURL=errgroup.js.map