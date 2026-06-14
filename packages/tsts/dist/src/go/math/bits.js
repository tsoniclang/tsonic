export function OnesCount(x) {
    let value = BigInt(x);
    let count = 0;
    while (value !== 0n) {
        count += Number(value & 1n);
        value >>= 1n;
    }
    return count;
}
export function OnesCount32(x) {
    let value = x >>> 0;
    value = value - ((value >>> 1) & 0x55555555);
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101 >>> 24);
}
//# sourceMappingURL=bits.js.map