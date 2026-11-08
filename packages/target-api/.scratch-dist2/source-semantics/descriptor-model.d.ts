import type { Node, SourceFile, SourcePrimitiveKind } from "@tsonic/tsts";
export type SourceTypeDescriptor = {
    readonly kind: "primitive";
    readonly primitive: SourcePrimitiveKind;
} | {
    readonly kind: "string";
} | {
    readonly kind: "intrinsic";
    readonly intrinsic: "any" | "unknown" | "object" | "void" | "never" | "absence" | "bigint" | "symbol";
} | {
    readonly kind: "union";
    readonly types: readonly SourceTypeDescriptor[];
} | {
    readonly kind: "array";
    readonly readonly: boolean;
    readonly element: SourceTypeDescriptor;
} | {
    readonly kind: "tuple";
    readonly readonly: boolean;
    readonly elements: readonly SourceTypeDescriptorTupleElement[];
} | {
    readonly kind: "shape";
    readonly members: readonly SourceTypeDescriptorMember[];
    readonly indexes: readonly SourceTypeDescriptorIndex[];
    readonly calls: readonly SourceTypeDescriptorSignature[];
    readonly constructs: readonly SourceTypeDescriptorSignature[];
} | {
    readonly kind: "callable";
    readonly calls: readonly SourceTypeDescriptorSignature[];
    readonly constructs: readonly SourceTypeDescriptorSignature[];
} | {
    readonly kind: "declared";
    readonly declaration: Node;
    readonly typeArguments: readonly SourceTypeDescriptor[];
    readonly definition?: SourceTypeDescriptor;
    readonly cut?: "recursion" | "unexpressible";
    readonly extent?: {
        readonly length: bigint;
        readonly lengthRuntimeBase: "number" | "bigint";
    };
} | {
    readonly kind: "optional";
    readonly value: SourceTypeDescriptor;
};
export interface SourceTypeDescriptorSignature {
    readonly declaration?: Node;
    readonly typeParameters: readonly Node[];
    readonly parameters: readonly {
        readonly declaration?: Node;
        readonly kind: "required" | "optional" | "rest";
        readonly type: SourceTypeDescriptor;
    }[];
    readonly result: SourceTypeDescriptor;
}
export interface SourceTypeDescriptorTupleElement {
    readonly kind: "required" | "optional" | "rest";
    readonly type: SourceTypeDescriptor;
    readonly declaration?: Node;
}
export interface SourceLiteralMemberCorrespondence {
    readonly property: Node;
    readonly origin: SourceTypeDescriptorMember["origin"];
}
export type SourceMemberKey = {
    readonly kind: "string";
    readonly value: string;
} | {
    readonly kind: "number";
    readonly value: number;
} | {
    readonly kind: "unique-symbol";
    readonly declaration: Node;
};
export interface SourceTypeDescriptorMember {
    readonly name: string;
    readonly optional: boolean;
    readonly type: SourceTypeDescriptor;
    readonly origin: {
        readonly kind: "declared";
        readonly declaration: Node;
    } | {
        readonly kind: "class-prototype";
        readonly owner: Node;
    } | {
        readonly kind: "mapped";
        readonly owner: Node;
        readonly key: SourceMemberKey;
    };
    readonly readonly?: boolean;
    readonly literals?: readonly SourceTypeDescriptorLiteral[];
}
export type SourceTypeDescriptorLiteral = {
    readonly kind: "string";
    readonly value: string;
} | {
    readonly kind: "number";
    readonly value: number;
} | {
    readonly kind: "bigint";
    readonly value: bigint;
} | {
    readonly kind: "boolean";
    readonly value: boolean;
};
export interface SourceTypeDescriptorIndex {
    readonly declaration: Node;
    readonly key: SourceTypeDescriptor;
    readonly value: SourceTypeDescriptor;
    readonly readonly: boolean;
}
export type SourceTypeFlowRefusalCode = "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE" | "TSONIC_LOCAL_TYPE_CONFLICT" | "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS" | "TSONIC_LOCAL_TYPE_SIGNATURE" | "TSONIC_UNTYPED_OBJECT_LITERAL" | "TSONIC_UNTYPED_ARRAY_LITERAL" | "TSONIC_LOCAL_TYPE_ACCUMULATOR" | "TSONIC_LOCAL_TYPE_UNION" | "TSONIC_LOCAL_TYPE_SELF_REFERENCE" | "TSONIC_LOCAL_TYPE_ADDRESS" | "TSONIC_LOCAL_TYPE_LIMIT" | "TSONIC_LOCAL_TYPE_GENERIC" | "TSONIC_LOCAL_TYPE_NUMBER_ERASURE_INEXACT" | "TSONIC_LOCAL_TYPE_UNSUPPORTED" | "TSONIC_NATIVE_INTEGER_WIDTH_MISSING" | "TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING";
export interface SourceTypeFlowRefusal {
    readonly kind: "refused";
    readonly source: "tsonic";
    readonly code: SourceTypeFlowRefusalCode;
    readonly site: Node;
    readonly related?: Node;
    readonly reason: string;
}
export interface SourceEffectiveTypeProvenance {
    readonly group: Node;
    readonly occurrence: Node;
    readonly sourceFile: SourceFile;
    readonly principal?: {
        readonly declaration: Node;
        readonly initializer: Node;
    };
    readonly filledBy?: Node;
    readonly component?: {
        readonly declaration?: Node;
        readonly authoredTypeNode?: Node;
    };
    readonly fixedRule?: SourceTypeFlowFixedRule;
}
export type SourceTypeFlowFixedRule = {
    readonly kind: "loop-counter";
    readonly declaration: Node;
};
export type SourceEffectiveTypeOutcome = {
    readonly kind: "resolved" | "default";
    readonly type: SourceTypeDescriptor;
    readonly construction?: SourceTypeDescriptor;
    readonly memberCorrespondence?: readonly SourceLiteralMemberCorrespondence[];
    readonly provenance: SourceEffectiveTypeProvenance;
} | SourceTypeFlowRefusal;
export interface SourceEffectiveTypeArgument {
    readonly declaration: Node;
    readonly type: SourceTypeDescriptor;
}
export interface SourceSumIdentity {
    readonly family: Node;
    readonly application: readonly SourceTypeDescriptor[];
}
export interface SourceClosedSum {
    readonly identity: SourceSumIdentity;
    readonly arms: readonly {
        readonly role: number;
        readonly type: SourceTypeDescriptor;
    }[];
    readonly roles: readonly {
        readonly role: number;
        readonly arms: readonly number[];
    }[];
}
export interface SourceMethodValueUse {
    readonly occurrence: Node;
    readonly read: Node;
    readonly receiver: Node;
    readonly declaration: Node;
    readonly type: SourceTypeDescriptor;
    readonly provenance: SourceEffectiveTypeProvenance;
    readonly alias: {
        readonly principal: Node;
        readonly initializer: Node;
        readonly provenance: SourceEffectiveTypeProvenance;
    } | undefined;
}
export type SourceSlotAdmission = {
    readonly kind: "admitted";
    readonly use: Node;
    readonly slot: Node;
    readonly value: SourceTypeDescriptor;
    readonly destination: SourceTypeDescriptor;
    readonly permission: "identity" | "widening";
    readonly conversion: {
        readonly kind: "identity";
    } | {
        readonly kind: "exact-number-erasure";
        readonly origin: Node;
        readonly result: SourceTypeDescriptor;
    };
} | {
    readonly kind: "refused";
    readonly use: Node;
    readonly slot: Node;
    readonly refusal: SourceTypeFlowRefusal;
};
export type SourceTypeFlowPathPart = {
    readonly kind: "element";
} | {
    readonly kind: "optional-value";
} | {
    readonly kind: "member";
    readonly name: string;
} | {
    readonly kind: "tuple";
    readonly index: number;
} | {
    readonly kind: "binder";
    readonly declaration: Node;
};
export declare function sourceTypeDescriptorsEqual(left: SourceTypeDescriptor, right: SourceTypeDescriptor): boolean;
/** The value key of a member literal (05 §2a D-2): equal keys are the same literal value. Numbers and bigints share the
 * integer spelling, as literal values do in the discriminant rule; the member's base type keeps them apart. */
export declare function sourceTypeDescriptorLiteralKey(literal: SourceTypeDescriptorLiteral): string;
export declare function sourceTypeDescriptorMemberLiteralsKey(member: SourceTypeDescriptorMember): string;
export declare function sourceTypeDescriptorTupleValue(type: Extract<SourceTypeDescriptor, {
    readonly kind: "tuple";
}>, index: number): SourceTypeDescriptor | undefined;
export declare function sourceTypeDescriptorStructure(type: SourceTypeDescriptor): SourceTypeDescriptor;
//# sourceMappingURL=descriptor-model.d.ts.map