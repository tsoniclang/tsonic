const offset64 = 14695981039346656037n;
const prime64 = 1099511628211n;
const secondSeed = 0x9e3779b97f4a7c15n;
const encoder = new TextEncoder();
const uint32Base = 0x100000000;
const prime64Low = Number(prime64 & 0xffffffffn);
const prime64High = Number((prime64 >> 32n) & 0xffffffffn);
const offset64Low = Number(offset64 & 0xffffffffn);
const offset64High = Number((offset64 >> 32n) & 0xffffffffn);
const secondSeedLow = Number(secondSeed & 0xffffffffn);
const secondSeedHigh = Number((secondSeed >> 32n) & 0xffffffffn);
function uint64FromParts(high, low) {
    return (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);
}
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
// eventually exhausted the heap. Consumers that need Go value-key semantics use
// GoStructMap instead.)
class hasher {
    highHigh = (offset64High ^ secondSeedHigh) >>> 0;
    highLow = (offset64Low ^ secondSeedLow) >>> 0;
    lowHigh = offset64High;
    lowLow = offset64Low;
    writeByte(value) {
        const byteValue = value & 0xff;
        const lowLow = (this.lowLow ^ byteValue) >>> 0;
        const lowProduct = lowLow * prime64Low;
        this.lowLow = lowProduct >>> 0;
        this.lowHigh = (this.lowHigh * prime64Low + lowLow * prime64High + Math.floor(lowProduct / uint32Base)) >>> 0;
        const seedLow = (secondSeedLow + byteValue) >>> 0;
        const seedHigh = (secondSeedHigh + (secondSeedLow + byteValue >= uint32Base ? 1 : 0)) >>> 0;
        const highLow = (this.highLow ^ seedLow) >>> 0;
        this.highHigh = (this.highHigh ^ seedHigh) >>> 0;
        const highProduct = highLow * prime64Low;
        this.highLow = highProduct >>> 0;
        this.highHigh = (this.highHigh * prime64Low + highLow * prime64High + Math.floor(highProduct / uint32Base)) >>> 0;
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
        return new uint128(uint64FromParts(this.highHigh, this.highLow), uint64FromParts(this.lowHigh, this.lowLow));
    }
    Sum64() {
        return uint64FromParts(this.lowHigh, this.lowLow);
    }
    Reset() {
        this.highHigh = (offset64High ^ secondSeedHigh) >>> 0;
        this.highLow = (offset64Low ^ secondSeedLow) >>> 0;
        this.lowHigh = offset64High;
        this.lowLow = offset64Low;
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