const offset64 = 14695981039346656037n;
const prime64 = 1099511628211n;
const mask64 = (1n << 64n) - 1n;
class fnv64a {
    value = offset64;
    Write(p) {
        for (const byteValue of p) {
            this.value ^= BigInt(byteValue & 0xff);
            this.value = (this.value * prime64) & mask64;
        }
        return [p.length, undefined];
    }
    Sum64() {
        return this.value;
    }
    Sum(p) {
        const output = p.slice();
        for (let shift = 56n; shift >= 0n; shift -= 8n) {
            output.push(Number((this.value >> shift) & 0xffn));
        }
        return output;
    }
    Reset() {
        this.value = offset64;
    }
}
export function New64a() {
    return new fnv64a();
}
//# sourceMappingURL=fnv.js.map