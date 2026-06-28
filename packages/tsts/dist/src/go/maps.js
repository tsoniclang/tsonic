// Go: package maps (standard library, Go 1.21+/1.23 iterators).
//
// In a single-threaded TypeScript runtime a Go map is modeled as a JS Map.
// Stdlib map iteration order is unspecified in Go; we iterate in JS Map
// insertion order, which is a valid concrete ordering.
// Clone returns a copy of m. This is a shallow clone: the new keys and values
// are set using ordinary assignment.
export function Clone(m) {
    // Go: Clone(nil) returns nil.
    if (m === undefined) {
        return undefined;
    }
    return new globalThis.Map(m);
}
// Copy copies all key/value pairs in src adding them to dst. When a key in src
// is already present in dst, the value in dst will be overwritten by the value
// associated with the key in src.
export function Copy(dst, src) {
    for (const [k, v] of src) {
        dst.set(k, v);
    }
}
// Equal reports whether two maps contain the same key/value pairs.
// Values are compared using ==.
export function Equal(m1, m2) {
    if (m1.size !== m2.size) {
        return false;
    }
    for (const [k, v1] of m1) {
        if (!m2.has(k)) {
            return false;
        }
        const v2 = m2.get(k);
        // Go uses == on comparable values; mirror with strict equality.
        if (v1 !== v2) {
            return false;
        }
    }
    return true;
}
// EqualFunc is like Equal, but compares values using eq. Keys are still
// compared with ==.
export function EqualFunc(m1, m2, eq) {
    if (m1.size !== m2.size) {
        return false;
    }
    for (const [k, v1] of m1) {
        if (!m2.has(k)) {
            return false;
        }
        const v2 = m2.get(k);
        if (!eq(v1, v2)) {
            return false;
        }
    }
    return true;
}
// Keys returns an iterator over keys in m. The iteration order is not
// specified and is not guaranteed to be the same from one call to the next.
export function Keys(m) {
    return (yieldValue) => {
        for (const k of (m ?? new globalThis.Map()).keys()) {
            if (!yieldValue(k)) {
                return;
            }
        }
    };
}
// Values returns an iterator over values in m. The iteration order is not
// specified and is not guaranteed to be the same from one call to the next.
export function Values(m) {
    return (yieldValue) => {
        for (const v of (m ?? new globalThis.Map()).values()) {
            if (!yieldValue(v)) {
                return;
            }
        }
    };
}
// DeleteFunc deletes any key/value pairs from m for which del returns true.
export function DeleteFunc(m, del) {
    for (const [key, value] of [...m]) {
        if (del(key, value)) {
            m.delete(key);
        }
    }
}
//# sourceMappingURL=maps.js.map