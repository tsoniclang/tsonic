import type {
  IrOverloadFamilyMember,
  IrParameter,
  IrType,
} from "@tsonic/frontend";
import type {
  FirstPartyBindingsExport,
  FirstPartyBindingsType,
} from "./types.js";

export type FirstPartySemanticSignature = {
  readonly typeParameters?: readonly string[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
};

export type FirstPartySemanticMethod = {
  readonly name: string;
  readonly signature?: FirstPartySemanticSignature;
  readonly overloadFamily?: IrOverloadFamilyMember;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
};

export type FirstPartySemanticProperty = {
  readonly name: string;
  readonly type?: IrType;
  readonly optional?: boolean;
  readonly isStatic: boolean;
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
};

export type FirstPartySemanticField = {
  readonly name: string;
  readonly type?: IrType;
  readonly optional?: boolean;
  readonly isStatic: boolean;
  readonly isReadOnly: boolean;
  readonly isLiteral: boolean;
};

export type FirstPartySemanticType = {
  readonly alias: string;
  readonly kind: "Class" | "Interface" | "Struct" | "Enum";
  readonly arity: number;
  readonly typeParameters?: readonly string[];
  readonly methods: readonly FirstPartySemanticMethod[];
  readonly properties: readonly FirstPartySemanticProperty[];
  readonly fields: readonly FirstPartySemanticField[];
};

export type FirstPartySemanticExport = {
  readonly kind: "function" | "value";
  readonly type?: IrType;
  readonly optional?: boolean;
  readonly signature?: FirstPartySemanticSignature;
};

export type FirstPartySemanticSurface = {
  readonly types: readonly FirstPartySemanticType[];
  readonly exports?: Readonly<Record<string, FirstPartySemanticExport>>;
};

export const buildSemanticTypeSurface = (
  typeBinding: FirstPartyBindingsType
): FirstPartySemanticType => ({
  alias: typeBinding.alias,
  kind: typeBinding.kind,
  arity: typeBinding.arity,
  typeParameters: typeBinding.typeParameters,
  methods: typeBinding.methods.map((method) => ({
    name: method.clrName,
    signature: method.semanticSignature,
    overloadFamily: method.overloadFamily,
    isStatic: method.isStatic,
    isAbstract: method.isAbstract,
    isVirtual: method.isVirtual,
    isOverride: method.isOverride,
  })),
  properties: typeBinding.properties.map((property) => ({
    name: property.clrName,
    type: property.semanticType,
    optional: property.semanticOptional,
    isStatic: property.isStatic,
    hasGetter: property.hasGetter,
    hasSetter: property.hasSetter,
  })),
  fields: typeBinding.fields.map((field) => ({
    name: field.clrName,
    type: field.semanticType,
    optional: field.semanticOptional,
    isStatic: field.isStatic,
    isReadOnly: field.isReadOnly,
    isLiteral: field.isLiteral,
  })),
});

export const buildSemanticExportSurface = (
  binding: FirstPartyBindingsExport
): FirstPartySemanticExport => ({
  kind:
    binding.kind === "method" || binding.kind === "functionType"
      ? "function"
      : "value",
  type: binding.semanticType,
  optional: binding.semanticOptional,
  signature: binding.semanticSignature,
});
