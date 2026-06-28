// Kind constants. Values match Go's iota ordering in reflect/type.go so that any
// numeric comparison or ordering matches Go exactly.
export const Invalid = 0;
export const Bool = 1;
export const Int = 2;
export const Int8 = 3;
export const Int16 = 4;
export const Int32 = 5;
export const Int64 = 6;
export const Uint = 7;
export const Uint8 = 8;
export const Uint16 = 9;
export const Uint32 = 10;
export const Uint64 = 11;
export const Uintptr = 12;
export const Float32 = 13;
export const Float64 = 14;
export const Complex64 = 15;
export const Complex128 = 16;
export const Array = 17;
export const Chan = 18;
export const Func = 19;
export const Interface = 20;
export const Map = 21;
export const Pointer = 22;
export const Slice = 23;
export const String = 24;
export const Struct = 25;
export const UnsafePointer = 26;
// Classify a runtime JS value into the Go Kind that typescript-go would observe
// for the corresponding JSON-parsed Go value.
//
// JSON-parsed Go values: bool, float64 (all JSON numbers), string, []any (Slice),
// *collections.OrderedMap (object) -> modeled here as Map for plain objects/Maps.
// A nil interface value has Kind Invalid.
function classifyKind(value) {
    if (value === undefined || value === null) {
        return Invalid;
    }
    if (typeof value === "boolean") {
        return Bool;
    }
    if (typeof value === "number") {
        // JSON numbers decode to Go float64.
        return Float64;
    }
    if (typeof value === "bigint") {
        return Int64;
    }
    if (typeof value === "string") {
        return String;
    }
    if (globalThis.Array.isArray(value)) {
        return Slice;
    }
    if (value instanceof globalThis.Map) {
        return Map;
    }
    // Plain object -> treated as a Go map/object value.
    return Map;
}
class descriptorType {
    descriptor;
    constructor(descriptor) {
        this.descriptor = descriptor;
    }
    Kind() {
        return this.descriptor.kind;
    }
    Name() {
        return this.descriptor.name ?? "";
    }
    Elem() {
        return this.descriptor.elem;
    }
    Fields() {
        return this.descriptor.fields ?? [];
    }
    Zero() {
        if (this.descriptor.zero !== undefined) {
            return this.descriptor.zero();
        }
        return zeroForKind(this.descriptor.kind);
    }
}
const registeredTypes = new globalThis.Map();
const interfaceType = new descriptorType({ kind: Interface, name: "interface{}" });
export function NewType(descriptor) {
    return new descriptorType(descriptor);
}
export function RegisterType(name, typ) {
    registeredTypes.set(name, typ);
}
// Value is the reflection interface to a Go value. This models a runtime JS value.
export class Value {
    // The wrapped runtime value (mutable container is intrinsic to reflect.Value).
    v;
    constructor(v) {
        this.v = v;
    }
    // Kind returns v's Kind.
    Kind() {
        return classifyKind(this.v);
    }
    // Type returns v's type.
    Type() {
        const kind = classifyKind(this.v);
        return { Kind: () => kind };
    }
    // IsNil reports whether its argument v is nil. Valid for chan, func, interface,
    // map, pointer, or slice values.
    IsNil() {
        return this.v === undefined || this.v === null;
    }
    // IsZero reports whether v is the zero value for its type.
    IsZero() {
        if (this.v === undefined || this.v === null)
            return true;
        if (typeof this.v === "boolean")
            return this.v === false;
        if (typeof this.v === "number")
            return this.v === 0;
        if (typeof this.v === "bigint")
            return this.v === 0n;
        if (typeof this.v === "string")
            return this.v === "";
        if (globalThis.Array.isArray(this.v))
            return this.v.length === 0;
        if (this.v instanceof globalThis.Map)
            return this.v.size === 0;
        return false;
    }
    // IsValid reports whether v represents a value (a non-nil, non-Invalid kind).
    IsValid() {
        return this.v !== undefined && this.v !== null;
    }
    // Len returns v's length. Valid for Array, Chan, Map, Slice, String.
    Len() {
        if (typeof this.v === "string") {
            return this.v.length;
        }
        if (globalThis.Array.isArray(this.v)) {
            return this.v.length;
        }
        if (this.v instanceof globalThis.Map) {
            return this.v.size;
        }
        throw new globalThis.Error("reflect: call of reflect.Value.Len on " + this.Kind() + " value");
    }
    // Index returns v's i'th element. Valid for Array, Slice, String.
    Index(i) {
        if (globalThis.Array.isArray(this.v)) {
            return new Value(this.v[i]);
        }
        if (typeof this.v === "string") {
            // Go indexes a string by byte; the JS analog over a code unit is sufficient
            // for the slice-iteration paths tsgo uses (it only iterates real slices).
            return new Value(this.v.charCodeAt(i));
        }
        throw new globalThis.Error("reflect: call of reflect.Value.Index on " + this.Kind() + " value");
    }
    // Int returns v's underlying value, as an int64. Valid for the int kinds.
    Int() {
        if (typeof this.v === "number") {
            return globalThis.Math.trunc(this.v);
        }
        if (typeof this.v === "bigint") {
            return globalThis.Number(this.v);
        }
        throw new globalThis.Error("reflect: call of reflect.Value.Int on " + this.Kind() + " value");
    }
    // Uint returns v's underlying value, as a uint64. Valid for the uint kinds.
    Uint() {
        if (typeof this.v === "number") {
            return globalThis.Math.trunc(this.v);
        }
        if (typeof this.v === "bigint") {
            return globalThis.Number(this.v);
        }
        throw new globalThis.Error("reflect: call of reflect.Value.Uint on " + this.Kind() + " value");
    }
    // String returns the string v's underlying value, as a string. For non-string
    // kinds Go returns "<kind Value>"; here we only support the String kind path
    // that tsgo exercises (resolveKeyName checks Kind == String first).
    String() {
        if (typeof this.v === "string") {
            return this.v;
        }
        return "<" + this.Kind() + " Value>";
    }
    // Bool returns v's underlying value. Valid for the Bool kind.
    Bool() {
        if (typeof this.v === "boolean") {
            return this.v;
        }
        throw new globalThis.Error("reflect: call of reflect.Value.Bool on " + this.Kind() + " value");
    }
    // Interface returns v's current value as an interface{} (the raw JS value).
    Interface() {
        return this.v;
    }
}
// TypeOf returns the reflection Type that represents the dynamic type of the
// runtime value. Returns undefined when the value is nil (Go returns nil Type).
export function TypeOf(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    const kind = classifyKind(value);
    return { Kind: () => kind };
}
// ValueOf returns a new Value initialized to the concrete value stored in the
// interface i.
export function ValueOf(value) {
    return new Value(value);
}
// DeepEqual reports whether x and y are "deeply equal". This is a faithful
// structural comparison: same type, recursively equal elements/fields/entries.
export function DeepEqual(x, y) {
    return deepEqual(x, y, new globalThis.Set());
}
function deepEqual(x, y, seen) {
    if (x === y) {
        return true;
    }
    // NaN is not == itself, but Go's DeepEqual on floats uses ==, so NaN != NaN.
    if (typeof x !== typeof y) {
        return false;
    }
    if (x === null || x === undefined || y === null || y === undefined) {
        // One is nil and they are not ===, so not equal.
        return x === y;
    }
    if (typeof x !== "object") {
        // Primitives already failed === above.
        return false;
    }
    // Guard against cycles (Go's DeepEqual tracks visited pointer pairs).
    if (seen.has(x)) {
        return true;
    }
    seen.add(x);
    const xIsArray = globalThis.Array.isArray(x);
    const yIsArray = globalThis.Array.isArray(y);
    if (xIsArray || yIsArray) {
        if (!xIsArray || !yIsArray) {
            return false;
        }
        const xa = x;
        const ya = y;
        if (xa.length !== ya.length) {
            return false;
        }
        for (let i = 0; i < xa.length; i = i + 1) {
            if (!deepEqual(xa[i], ya[i], seen)) {
                return false;
            }
        }
        return true;
    }
    if (x instanceof globalThis.Map || y instanceof globalThis.Map) {
        if (!(x instanceof globalThis.Map) || !(y instanceof globalThis.Map)) {
            return false;
        }
        if (x.size !== y.size) {
            return false;
        }
        for (const [k, v] of x.entries()) {
            if (!y.has(k)) {
                return false;
            }
            if (!deepEqual(v, y.get(k), seen)) {
                return false;
            }
        }
        return true;
    }
    // Plain objects: compare own enumerable keys.
    const xObj = x;
    const yObj = y;
    const xKeys = globalThis.Object.keys(xObj);
    const yKeys = globalThis.Object.keys(yObj);
    if (xKeys.length !== yKeys.length) {
        return false;
    }
    for (const key of xKeys) {
        if (!globalThis.Object.prototype.hasOwnProperty.call(yObj, key)) {
            return false;
        }
        if (!deepEqual(xObj[key], yObj[key], seen)) {
            return false;
        }
    }
    return true;
}
export function TypeFor(name) {
    if (name !== undefined) {
        return registeredTypes.get(name) ?? interfaceType;
    }
    return interfaceType;
}
export function TypeAssert(v, guard) {
    const value = v.Interface();
    if (value === undefined || value === null) {
        return [undefined, false];
    }
    if (guard !== undefined && !guard(value)) {
        return [undefined, false];
    }
    return [value, true];
}
export function MakeSlice(typ, len, cap) {
    if (len < 0 || cap < len) {
        throw new globalThis.Error("reflect.MakeSlice: length/capacity out of range");
    }
    const elem = typ.Elem?.();
    const zero = elem?.Zero?.() ?? zeroForKind(elem?.Kind() ?? Interface);
    return new Value(new globalThis.Array(len).fill(zero));
}
export function Append(s, ...x) {
    const value = s.Interface();
    if (!globalThis.Array.isArray(value)) {
        throw new globalThis.Error("reflect.Append: first argument is not a slice");
    }
    return new Value([...value, ...x.map((entry) => entry.Interface())]);
}
export function Zero(typ) {
    return new Value(typ.Zero?.() ?? zeroForKind(typ.Kind()));
}
export function VisibleFields(t) {
    return t.Fields?.() ?? [];
}
function zeroForKind(kind) {
    switch (kind) {
        case Bool:
            return false;
        case Int:
        case Int8:
        case Int16:
        case Int32:
        case Int64:
        case Uint:
        case Uint8:
        case Uint16:
        case Uint32:
        case Uint64:
        case Uintptr:
        case Float32:
        case Float64:
            return 0;
        case String:
            return "";
        case Array:
        case Slice:
            return [];
        case Map:
            return new globalThis.Map();
        default:
            return undefined;
    }
}
//# sourceMappingURL=reflect.js.map