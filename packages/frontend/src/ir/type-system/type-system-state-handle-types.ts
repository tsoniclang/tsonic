import type { IrMethodSignature, IrType } from "../types/index.js";
import type { TypeId } from "./internal/universe/types.js";
import type {
  DeclId,
  MemberId,
  ParameterMode,
  SignatureId,
  TypeParameterInfo,
  TypeSyntaxId,
} from "./types.js";
import type { TypePredicateResult } from "./type-system-state-call-types.js";

export type RawSignatureInfo = {
  readonly parameterTypes: readonly (IrType | undefined)[];
  readonly parameterFlags: readonly {
    readonly isRest: boolean;
    readonly isOptional: boolean;
  }[];
  readonly thisParameterType?: IrType;
  readonly returnType: IrType;
  readonly hasDeclaredReturnType: boolean;
  readonly parameterModes: readonly ParameterMode[];
  readonly typeParameters: readonly TypeParameterInfo[];
  readonly parameterNames: readonly string[];
  readonly typePredicate?: TypePredicateResult;
  readonly declaringTypeTsName?: string;
  readonly declaringTypeParameterNames?: readonly string[];
  readonly declaringMemberName?: string;
};

export type HandleRegistry = {
  getDecl(id: DeclId): DeclInfo | undefined;
  getSignature(id: SignatureId): SignatureInfo | undefined;
  getMember(id: MemberId): MemberInfo | undefined;
  getTypeSyntax(id: TypeSyntaxId): TypeSyntaxInfo | undefined;
};

export type TypeSyntaxInfo = {
  readonly typeNode: unknown;
};

export type ClassMemberNames = {
  readonly typeParameters: readonly string[];
  readonly methods: ReadonlySet<string>;
  readonly properties: ReadonlySet<string>;
  readonly methodSignatures: ReadonlyMap<
    string,
    readonly CapturedClassMethodSignature[]
  >;
  readonly propertyTypeNodes: ReadonlyMap<string, unknown | undefined>;
};

export type CapturedClassMethodSignature = {
  readonly parameters: readonly CapturedClassMethodParameter[];
};

export type CapturedClassMethodParameter = {
  readonly typeNode?: unknown;
  readonly isRest: boolean;
};

export type DeclInfo = {
  readonly typeNode?: unknown;
  readonly kind: DeclKind;
  readonly fqName?: string;
  readonly declNode?: unknown;
  readonly typeDeclNode?: unknown;
  readonly valueDeclNode?: unknown;
  readonly classMemberNames?: ClassMemberNames;
};

export type DeclKind =
  | "variable"
  | "function"
  | "class"
  | "interface"
  | "typeAlias"
  | "enum"
  | "parameter"
  | "property"
  | "method";

export type SignatureInfo = {
  readonly parameters: readonly ParameterNode[];
  readonly thisTypeNode?: unknown;
  readonly returnTypeNode?: unknown;
  readonly typeParameters?: readonly TypeParameterNode[];
  readonly declaringTypeTsName?: string;
  readonly declaringTypeParameterNames?: readonly string[];
  readonly declaringMemberName?: string;
  readonly typePredicate?: SignatureTypePredicateRaw;
};

export type SignatureTypePredicateRaw =
  | {
      readonly kind: "param";
      readonly parameterName: string;
      readonly parameterIndex: number;
      readonly targetTypeNode: unknown;
    }
  | {
      readonly kind: "this";
      readonly targetTypeNode: unknown;
    };

export type ParameterNode = {
  readonly name: string;
  readonly typeNode?: unknown;
  readonly isOptional: boolean;
  readonly isRest: boolean;
  readonly mode?: ParameterMode;
};

export type TypeParameterNode = {
  readonly name: string;
  readonly constraintNode?: unknown;
  readonly defaultNode?: unknown;
};

export type MemberInfo = {
  readonly name: string;
  readonly declNode?: unknown;
  readonly typeNode?: unknown;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
};

export type TypeRegistryAPI = {
  resolveNominal(fqName: string): TypeRegistryEntry | undefined;
  resolveBySimpleName(simpleName: string): TypeRegistryEntry | undefined;
  getFQName(simpleName: string): string | undefined;
  getMemberType(fqNominal: string, memberName: string): IrType | undefined;
  hasType(fqName: string): boolean;
};

export type TypeParameterEntry = {
  readonly name: string;
  readonly constraint?: IrType;
  readonly defaultType?: IrType;
};

export type TypeRegistryEntry = {
  readonly kind: "class" | "interface" | "typeAlias";
  readonly name: string;
  readonly fullyQualifiedName: string;
  readonly typeParameters: readonly TypeParameterEntry[];
  readonly members: ReadonlyMap<string, TypeRegistryMemberInfo>;
};

export type TypeRegistryMemberInfo = {
  readonly kind: "property" | "method" | "indexSignature";
  readonly name: string;
  readonly type: IrType | undefined;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly methodSignatures?: readonly IrMethodSignature[];
};

export type NominalEnvAPI = {
  getInheritanceChain(typeId: TypeId): readonly TypeId[];
  getInstantiation(
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    targetTypeId: TypeId
  ): ReadonlyMap<string, IrType> | undefined;
  findMemberDeclaringType(
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    memberName: string
  ): MemberLookupResult | undefined;
};

export type MemberLookupResult = {
  readonly declaringTypeId: TypeId;
  readonly substitution: ReadonlyMap<string, IrType>;
};
