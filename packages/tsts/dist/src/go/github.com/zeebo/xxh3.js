const offset64 = 14695981039346656037n;
const prime64 = 1099511628211n;
const mask64 = (1n << 64n) - 1n;
const secondSeed = 0x9e3779b97f4a7c15n;
const encoder = new TextEncoder();
class uint128 {
    Hi;
    Lo;
    constructor(Hi, Lo) {
        this.Hi = Hi;
        this.Lo = Lo;
    }
    Bytes() {
        return [...uint64Bytes(this.Hi), ...uint64Bytes(this.Lo)];
    }
    IsZero() {
        return this.Hi === 0n && this.Lo === 0n;
    }
    String() {
        return this.Hi.toString(16).padStart(16, "0") + this.Lo.toString(16).padStart(16, "0");
    }
}
// Go's xxh3.Uint128 is a VALUE; Sum128 must not retain anything at module
// scope. (An earlier revision interned every distinct hash in a module-level
// Map so plain-Map consumers could key by object identity; with millions of
// unique cache keys per full-lib check the table grew without bound and
// eventually exhausted the heap. Checker cache keys are now primitive strings
// — see CacheHashKey — so no interning is needed for value semantics.)
class hasher {
    hi = offset64 ^ secondSeed;
    lo = offset64;
    writeByte(value) {
        const byteValue = BigInt(value & 0xff);
        this.lo ^= byteValue;
        this.lo = (this.lo * prime64) & mask64;
        this.hi ^= byteValue + secondSeed;
        this.hi = (this.hi * prime64) & mask64;
    }
    Write(p) {
        for (const value of p) {
            this.writeByte(value);
        }
        return [p.length, undefined];
    }
    WriteString(s) {
        // ASCII fast path: hash UTF-16 code units directly — identical to the
        // UTF-8 byte sequence for ASCII — without allocating an encoded copy.
        // Cache-key building hashes millions of short, almost always ASCII
        // fragments; per-call TextEncoder allocations dominated runner memory churn.
        let ascii = true;
        for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            if (code >= 0x80) {
                ascii = false;
                break;
            }
        }
        if (ascii) {
            for (let i = 0; i < s.length; i++) {
                this.writeByte(s.charCodeAt(i));
            }
            return [s.length, undefined];
        }
        const bytes = encoder.encode(s);
        for (let i = 0; i < bytes.length; i++) {
            this.writeByte(bytes[i]);
        }
        return [bytes.length, undefined];
    }
    Sum128() {
        return new uint128(this.hi, this.lo);
    }
    Sum64() {
        return this.lo;
    }
    Reset() {
        this.hi = offset64 ^ secondSeed;
        this.lo = offset64;
    }
}
export function HashString128(s) {
    const h = New();
    h.WriteString(s);
    return h.Sum128();
}
export function New() {
    return new hasher();
}
function uint64Bytes(value) {
    const out = [];
    for (let shift = 56n; shift >= 0n; shift -= 8n) {
        out.push(Number((value >> shift) & 0xffn));
    }
    return out;
}
//# sourceMappingURL=xxh3.js.map