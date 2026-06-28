import type { int, uint, bool } from "./scalars.js";
import type { GoSlice } from "./compat.js";
export type Kind = int;
export declare const Invalid: Kind;
export declare const Bool: Kind;
export declare const Int: Kind;
export declare const Int8: Kind;
export declare const Int16: Kind;
export declare const Int32: Kind;
export declare const Int64: Kind;
export declare const Uint: Kind;
export declare const Uint8: Kind;
export declare const Uint16: Kind;
export declare const Uint32: Kind;
export declare const Uint64: Kind;
export declare const Uintptr: Kind;
export declare const Float32: Kind;
export declare const Float64: Kind;
export declare const Complex64: Kind;
export declare const Complex128: Kind;
export declare const Array: Kind;
export declare const Chan: Kind;
export declare const Func: Kind;
export declare const Interface: Kind;
export declare const Map: Kind;
export declare const Pointer: Kind;
export declare const Slice: Kind;
export declare const String: Kind;
export declare const Struct: Kind;
export declare const UnsafePointer: Kind;
export interface Type {
    Kind(): Kind;
    Name?(): string;
    Elem?(): Type | undefined;
    Fields?(): GoSlice<StructField>;
    Zero?(): unknown;
}
export interface TypeDescriptor {
    readonly kind: Kind;
    readonly name?: string;
    readonly elem?: Type;
    readonly fields?: GoSlice<StructField>;
    readonly zero?: () => unknown;
}
export declare function NewType(descriptor: TypeDescriptor): Type;
export declare function RegisterType(name: string, typ: Type): void;
export declare class Value {
    private readonly v;
    constructor(v: unknown);
    Kind(): Kind;
    Type(): Type;
    IsNil(): bool;
    IsZero(): bool;
    IsValid(): bool;
    Len(): int;
    Index(i: int): Value;
    Int(): int;
    Uint(): uint;
    String(): string;
    Bool(): bool;
    Interface(): unknown;
}
export declare function TypeOf(value: unknown): Type | undefined;
export declare function ValueOf(value: unknown): Value;
export declare function DeepEqual(x: unknown, y: unknown): bool;
export interface StructField {
    readonly Name: string;
    readonly Type: Type;
}
export declare function TypeFor<T>(name?: string): Type;
export declare function TypeAssert<T>(v: Value, guard?: (value: unknown) => value is T): [T | undefined, bool];
export declare function MakeSlice(typ: Type, len: int, cap: int): Value;
export declare function Append(s: Value, ...x: GoSlice<Value>): Value;
export declare function Zero(typ: Type): Value;
export declare function VisibleFields(t: Type): GoSlice<StructField>;
//# sourceMappingURL=reflect.d.ts.map