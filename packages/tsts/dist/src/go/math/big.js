export class Int {
    value;
    constructor(value = 0n) {
        this.value = BigInt(value);
    }
    Set(x) {
        this.value = x.value;
        return this;
    }
    SetInt64(x) {
        this.value = BigInt(x);
        return this;
    }
    Int64() {
        return this.value;
    }
    Sign() {
        return (this.value < 0n ? -1 : this.value > 0n ? 1 : 0);
    }
    Cmp(y) {
        return (this.value < y.value ? -1 : this.value > y.value ? 1 : 0);
    }
    Add(x, y) {
        this.value = x.value + y.value;
        return this;
    }
    Sub(x, y) {
        this.value = x.value - y.value;
        return this;
    }
    Mul(x, y) {
        this.value = x.value * y.value;
        return this;
    }
    Quo(x, y) {
        this.value = x.value / y.value;
        return this;
    }
    Rem(x, y) {
        this.value = x.value % y.value;
        return this;
    }
    String() {
        return this.value.toString();
    }
}
export class Float {
    value;
    constructor(value = 0) {
        this.value = value;
    }
    String() {
        return String(this.value);
    }
}
export function NewInt(value) {
    return new Int(value);
}
//# sourceMappingURL=big.js.map