// Authored Go sync/atomic facade — single-threaded semantics.
//
// TS-Go's single-threaded build performs no real concurrency, so each atomic
// type is modeled as a plain mutable cell. Load/Store/Swap/CompareAndSwap/Add
// operate directly on the cell (no memory ordering is observable without
// goroutines). The 32-bit integer types wrap on store/swap/add to match Go's
// fixed-width arithmetic; the 64-bit types use JavaScript numbers, which are
// exact for the small counter values TS-Go stores in them.
export class Bool {
    value = false;
    Load() {
        return this.value;
    }
    Store(value) {
        this.value = value;
    }
    Swap(newValue) {
        const old = this.value;
        this.value = newValue;
        return old;
    }
    CompareAndSwap(oldValue, newValue) {
        if (this.value === oldValue) {
            this.value = newValue;
            return true;
        }
        return false;
    }
}
export class Int32 {
    value = 0;
    Load() {
        return this.value;
    }
    Store(value) {
        this.value = value | 0;
    }
    Swap(newValue) {
        const old = this.value;
        this.value = newValue | 0;
        return old;
    }
    CompareAndSwap(oldValue, newValue) {
        if (this.value === (oldValue | 0)) {
            this.value = newValue | 0;
            return true;
        }
        return false;
    }
    Add(delta) {
        this.value = (this.value + delta) | 0;
        return this.value;
    }
}
export class Int64 {
    value = 0;
    Load() {
        return this.value;
    }
    Store(value) {
        this.value = value;
    }
    Swap(newValue) {
        const old = this.value;
        this.value = newValue;
        return old;
    }
    CompareAndSwap(oldValue, newValue) {
        if (this.value === oldValue) {
            this.value = newValue;
            return true;
        }
        return false;
    }
    Add(delta) {
        this.value = this.value + delta;
        return this.value;
    }
}
export class Uint32 {
    value = 0;
    Load() {
        return this.value;
    }
    Store(value) {
        this.value = value >>> 0;
    }
    Swap(newValue) {
        const old = this.value;
        this.value = newValue >>> 0;
        return old;
    }
    CompareAndSwap(oldValue, newValue) {
        if (this.value === (oldValue >>> 0)) {
            this.value = newValue >>> 0;
            return true;
        }
        return false;
    }
    Add(delta) {
        this.value = (this.value + delta) >>> 0;
        return this.value;
    }
}
export class Uint64 {
    value = 0;
    Load() {
        return this.value;
    }
    Store(value) {
        this.value = value;
    }
    Swap(newValue) {
        const old = this.value;
        this.value = newValue;
        return old;
    }
    CompareAndSwap(oldValue, newValue) {
        if (this.value === oldValue) {
            this.value = newValue;
            return true;
        }
        return false;
    }
    Add(delta) {
        this.value = this.value + delta;
        return this.value;
    }
}
//# sourceMappingURL=atomic.js.map