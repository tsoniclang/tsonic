import { hostDiagnosticCode, requirePresent } from "../diag/index.js";
import { candidateListId, decodeBodyId, decodeDefId, decodeGroupId, decodeModuleId, encodeBodyId, encodeDefId, encodeGroupId, encodeModuleId, expansionId, localId, nodeId, sigId, tyId } from "../ids/index.js";
import type { HostDiagnosticCode } from "../diag/contract.js";
import type { BodyId, CandidateListId, DefId, Derivation, ExpansionId, GroupId, ItemNodeRef, LocalId, LocalRef, ModuleId, NodeId, NodeRef, Origin, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { BindingVector, ExactRational, LiteralValue, MemberKey, MemberOrigin, SelfBinding, TypeBinding, TypeParameterIdentity } from "../ir-types/contract.js";

export interface Field {
  readonly name: string;
  readonly shape: SchemaMetadata;
}

export type ScalarName = "number" | "bigint" | "string" | "boolean" | "n" | "l" | "t" | "sig" | "cand"
  | "def" | "body" | "group" | "mod" | "exp";

export type Shape =
  | { readonly kind: "scalar"; readonly name: ScalarName }
  | { readonly kind: "nullable"; readonly value: SchemaMetadata }
  | { readonly kind: "array"; readonly element: SchemaMetadata }
  | { readonly kind: "enum"; readonly values: readonly (string | number)[] }
  | RecordShape | RecordChoiceShape;

export interface RecordShape {
  readonly kind: "record";
  readonly label: string;
  readonly fields: readonly Field[];
}

export interface RecordChoiceShape {
  readonly kind: "union";
}

export interface SchemaMetadata {
  readonly name: string;
  readonly shape: () => Shape;
}

export interface Schema<Value> extends SchemaMetadata {
  readonly stage: (value: Value) => Staged;
  readonly reader: (receive: (value: Value) => void) => Reader;
}

export interface RecordSchemaMetadata extends SchemaMetadata {
  readonly shape: () => RecordShape | RecordChoiceShape;
}

export interface RecordSchema<Value> extends Schema<Value> {
  readonly shape: () => RecordShape | RecordChoiceShape;
  readonly reader: (receive: (value: Value) => void) => RecordReaderGroup;
}

export type Reader =
  | { readonly kind: "scalar"; readonly name: ScalarName; readonly receive: (value: unknown, prefix: string | null) => boolean }
  | { readonly kind: "enum"; readonly values: readonly (string | number)[]; readonly receive: (value: string | number) => void }
  | { readonly kind: "nullable"; readonly value: () => Reader; readonly receive: () => void }
  | { readonly kind: "array"; readonly element: SchemaMetadata; readonly item: (index: number) => Reader; readonly complete: () => void }
  | RecordReaderGroup;

export interface RecordReaderGroup {
  readonly kind: "records";
  readonly records: () => readonly RecordReader[];
}

export interface RecordReader {
  readonly shape: RecordShape;
  readonly prepare: () => RecordConstruction;
}

interface RecordConstruction {
  readonly fields: readonly { readonly name: string; readonly reader: () => Reader }[];
  readonly complete: () => void;
}

export type DataReference =
  | { readonly kind: "type"; readonly value: TyId }
  | { readonly kind: "signature"; readonly value: SigId }
  | { readonly kind: "definition"; readonly value: DefId }
  | { readonly kind: "node"; readonly value: NodeRef }
  | { readonly kind: "item"; readonly value: ItemNodeRef }
  | { readonly kind: "local"; readonly value: LocalRef };

type ScalarValue = string | number | bigint | boolean | null;

export type Staged =
  | { readonly kind: "scalar"; readonly prefix: string; readonly value: ScalarValue; readonly reference: DataReference | null }
  | { readonly kind: "record"; readonly source: object; readonly label: string; readonly reference: DataReference | null;
      readonly fields: () => readonly { readonly name: string; readonly value: Staged }[] }
  | { readonly kind: "array"; readonly source: object; readonly length: number; readonly read: (index: number) => Staged | undefined };

interface ProjectionField<Value> {
  readonly name: string;
  readonly shape: () => SchemaMetadata;
  readonly stage: (value: Value) => Staged;
  readonly reader: () => Reader;
}

interface FieldSlot<Value, Child> extends ProjectionField<Value> {
  readonly value: () => Child;
}

type FieldReader<Value> = <Child>(name: string, schema: () => Schema<Child>,
  project: (value: Value) => Child) => FieldSlot<Value, Child>;

interface RecordBuild<Value> {
  readonly fields: readonly ProjectionField<Value>[];
  readonly value: () => Value;
}

const constructionFailure = Object.freeze({ owner: "ir-infer", query: null, origin: null,
  message: "The validated text construction must publish every declared field." }) satisfies import("../diag/contract.js").InvariantFailure;

export function recordSchema<Value extends object>(name: string, label: string,
  configure: (read: FieldReader<Value>) => RecordBuild<Value>,
  reference: ((value: Value) => DataReference) | null = null): RecordSchema<Value> {
  const read: FieldReader<Value> = <Child>(field: string, schema: () => Schema<Child>, project: (value: Value) => Child): FieldSlot<Value, Child> => {
    let publication: Child | undefined;
    return { name: field, shape: () => schema(), stage: value => schema().stage(project(value)),
      reader: () => schema().reader(value => { publication = value; }),
      value: () => requirePresent(publication, constructionFailure) };
  };
  const layout = () => configure(read);
  const fields = layout().fields;
  const shape = (): RecordShape => ({ kind: "record", label,
    fields: fields.map(field => ({ name: field.name, shape: field.shape() })) });
  return { name, shape,
  reader: receive => ({ kind: "records", records: () => [{ shape: shape(), prepare: () => {
    const record = layout();
    return { fields: record.fields, complete: () => receive(record.value()) };
  } }] }),
  stage: value => ({ kind: "record", source: value, label, reference: reference === null ? null : reference(value),
    fields: () => fields.map(field => ({ name: field.name, value: field.stage(value) })) }) };
}

interface ReadRecordSchema<Value> extends RecordSchemaMetadata {
  readonly reader: (receive: (value: Value) => void) => RecordReaderGroup;
}

export function unionSchema<Value>(name: string, alternatives: () => readonly ReadRecordSchema<Value>[],
  stage: (value: Value) => Staged): RecordSchema<Value> {
  return { name, shape: () => ({ kind: "union" }), stage,
    reader: receive => ({ kind: "records", records: () => alternatives().flatMap(schema => schema.reader(receive).records()) }) };
}

export function numberText(value: number): string {
  if (Object.is(value, -0)) return "-0";
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "+Infinity";
  return String(value);
}

function scalarSchema<Value extends ScalarValue>(name: ScalarName, decode: (value: unknown) => Value | undefined,
  reference: ((value: Value) => DataReference) | null = null): Schema<Value> {
  const prefix = ["number", "bigint", "string", "boolean"].includes(name) ? "" : `${name}:`;
  return { name, shape: () => ({ kind: "scalar", name }), reader: receive => ({ kind: "scalar", name,
    receive: (value, givenPrefix) => {
      if (givenPrefix !== (prefix === "" ? null : name)) return false;
      const decoded = decode(value);
      if (decoded === undefined) return false;
      receive(decoded); return true;
    } }),
    stage: value => ({ kind: "scalar", prefix, value, reference: reference === null ? null : reference(value) }) };
}

export function enumSchema<Value extends string | number>(name: string, values: readonly Value[]): Schema<Value> {
  return { name, shape: () => ({ kind: "enum", values }),
  reader: receive => ({ kind: "enum", values,
    receive: value => receive(requirePresent(values.find(choice => Object.is(choice, value)), constructionFailure)) }),
  stage: value => ({ kind: "scalar", prefix: "", value, reference: null }) };
}

export function nullableSchema<Value>(schema: Schema<Value>): Schema<Value | null> {
  return { name: `${schema.name}?`, shape: () => ({ kind: "nullable", value: schema }),
    reader: receive => ({ kind: "nullable", value: () => schema.reader(receive), receive: () => receive(null) }),
    stage: value => value === null ? { kind: "scalar", prefix: "", value: null, reference: null } : schema.stage(value) };
}

export function arraySchema<Value>(schema: Schema<Value>): Schema<readonly Value[]> {
  return { name: `${schema.name}*`, shape: () => ({ kind: "array", element: schema }),
    reader: receive => {
      const values: Value[] = [];
      return { kind: "array", element: schema, item: index => schema.reader(value => { values[index] = value; }),
        complete: () => receive(values) };
    },
    stage: values => ({ kind: "array", source: values, length: values.length, read: index => {
      const value = values[index];
      return value === undefined ? undefined : schema.stage(value);
    } }) };
}

export interface BodySourceRecord {
  readonly kind: "body";
  readonly value: NodeRef;
}

export interface ItemSourceRecord {
  readonly kind: "item";
  readonly value: ItemNodeRef;
}

export interface LoweringDerivationRecord {
  readonly kind: "lowering";
  readonly pass: "front" | "decls" | "infer" | "elaborate" | "validate" | "lower-mir" | "evaluate" | "metadata" | "liveness" | "initialization" | "refinements" | "origins" | "suspension" | "errorStorage" | "pointerBacking" | "summaries" | "pipeline";
}

export interface ExpansionDerivationRecord {
  readonly kind: "expansion";
  readonly expansion: ExpansionId;
}

export interface BoundTypeRecord {
  readonly kind: "bound";
  readonly parameter: TypeParameterIdentity;
  readonly type: TyId;
}

export interface RigidTypeRecord {
  readonly kind: "rigid";
  readonly parameter: TypeParameterIdentity;
}

export interface BoundSelfRecord {
  readonly kind: "bound";
  readonly owner: DefId;
  readonly type: TyId;
}

export interface RigidSelfRecord {
  readonly kind: "rigid";
  readonly owner: DefId;
}

export interface NumberLiteralRecord {
  readonly kind: "number";
  readonly token: string;
  readonly value: ExactRational;
}

export interface BigintLiteralRecord {
  readonly kind: "bigint";
  readonly token: string;
  readonly value: bigint;
}

export interface StringLiteralRecord {
  readonly kind: "string";
  readonly value: string;
}

export interface BooleanLiteralRecord {
  readonly kind: "boolean";
  readonly value: boolean;
}

export interface AbsenceLiteralRecord {
  readonly kind: "absence";

}

export interface SymbolLiteralRecord {
  readonly kind: "unique-symbol";
  readonly declaration: DefId;
}

export interface TextKeyRecord {
  readonly kind: "text";
  readonly value: string;
}

export interface NumberKeyRecord {
  readonly kind: "number";
  readonly value: ExactRational;
}

export interface SymbolKeyRecord {
  readonly kind: "symbol";
  readonly declaration: DefId;
}

export interface DeclaredOriginRecord {
  readonly kind: "declared";
  readonly declaration: DefId;
}

export interface PrototypeOriginRecord {
  readonly kind: "class-prototype";
  readonly owner: DefId;
}

export interface MappedOriginRecord {
  readonly kind: "mapped";
  readonly owner: SourceNodeRef;
  readonly key: MemberKey;
}

export interface DataSchemas {
  readonly numberSchema: Schema<number>;
  readonly bigintSchema: Schema<bigint>;
  readonly stringSchema: Schema<string>;
  readonly booleanSchema: Schema<boolean>;
  readonly nSchema: Schema<NodeId>;
  readonly lSchema: Schema<LocalId>;
  readonly tSchema: Schema<TyId>;
  readonly sigSchema: Schema<SigId>;
  readonly candSchema: Schema<CandidateListId>;
  readonly defSchema: Schema<DefId>;
  readonly bodySchema: Schema<BodyId>;
  readonly groupSchema: Schema<GroupId>;
  readonly modSchema: Schema<ModuleId>;
  readonly expSchema: Schema<ExpansionId>;
  readonly nodeRefSchema: RecordSchema<NodeRef>;
  readonly itemNodeRefSchema: RecordSchema<ItemNodeRef>;
  readonly sourceNodeRefSchema: RecordSchema<SourceNodeRef>;
  readonly bodySourceSchema: RecordSchema<BodySourceRecord>;
  readonly itemSourceSchema: RecordSchema<ItemSourceRecord>;
  readonly localRefSchema: RecordSchema<LocalRef>;
  readonly originSchema: RecordSchema<Origin>;
  readonly derivationSchema: RecordSchema<Derivation>;
  readonly loweringDerivationSchema: RecordSchema<LoweringDerivationRecord>;
  readonly expansionDerivationSchema: RecordSchema<ExpansionDerivationRecord>;
  readonly passNameSchema: Schema<"decls" | "elaborate" | "errorStorage" | "evaluate" | "front" | "infer" | "initialization" | "liveness" | "lower-mir" | "metadata" | "origins" | "pipeline" | "pointerBacking" | "refinements" | "summaries" | "suspension" | "validate">;
  readonly typeParameterIdentitySchema: RecordSchema<TypeParameterIdentity>;
  readonly bindingVectorSchema: RecordSchema<BindingVector>;
  readonly typeBindingSchema: RecordSchema<TypeBinding>;
  readonly boundTypeSchema: RecordSchema<BoundTypeRecord>;
  readonly rigidTypeSchema: RecordSchema<RigidTypeRecord>;
  readonly selfBindingSchema: RecordSchema<SelfBinding>;
  readonly boundSelfSchema: RecordSchema<BoundSelfRecord>;
  readonly rigidSelfSchema: RecordSchema<RigidSelfRecord>;
  readonly exactRationalSchema: RecordSchema<ExactRational>;
  readonly literalValueSchema: RecordSchema<LiteralValue>;
  readonly numberLiteralSchema: RecordSchema<NumberLiteralRecord>;
  readonly bigintLiteralSchema: RecordSchema<BigintLiteralRecord>;
  readonly stringLiteralSchema: RecordSchema<StringLiteralRecord>;
  readonly booleanLiteralSchema: RecordSchema<BooleanLiteralRecord>;
  readonly absenceLiteralSchema: RecordSchema<AbsenceLiteralRecord>;
  readonly symbolLiteralSchema: RecordSchema<SymbolLiteralRecord>;
  readonly memberKeySchema: RecordSchema<MemberKey>;
  readonly textKeySchema: RecordSchema<TextKeyRecord>;
  readonly numberKeySchema: RecordSchema<NumberKeyRecord>;
  readonly symbolKeySchema: RecordSchema<SymbolKeyRecord>;
  readonly memberOriginSchema: RecordSchema<MemberOrigin>;
  readonly declaredOriginSchema: RecordSchema<DeclaredOriginRecord>;
  readonly prototypeOriginSchema: RecordSchema<PrototypeOriginRecord>;
  readonly mappedOriginSchema: RecordSchema<MappedOriginRecord>;
  readonly passingModeSchema: Schema<"borrow-mut" | "borrow-shared" | "by-value" | "byref-readonly" | "byref-readwrite" | "byref-writeonly-must-init" | "move">;
  readonly hostCodeNameSchema: Schema<HostDiagnosticCode>;
}

export function createDataSchemas(): DataSchemas {
  const numberSchema = scalarSchema<number>("number", value => typeof value === "number" ? value : undefined);

  const bigintSchema = scalarSchema<bigint>("bigint", value => typeof value === "bigint" ? value : undefined);

  const stringSchema = scalarSchema<string>("string", value => typeof value === "string" ? value : undefined);

  const booleanSchema = scalarSchema<boolean>("boolean", value => typeof value === "boolean" ? value : undefined);

  const nSchema = scalarSchema<NodeId>("n", value => typeof value === "number" ? nodeId(value) : undefined);

  const lSchema = scalarSchema<LocalId>("l", value => typeof value === "number" ? localId(value) : undefined);

  const tSchema = scalarSchema<TyId>("t", value => typeof value === "number" ? tyId(value) : undefined, value => ({ kind: "type", value }));

  const sigSchema = scalarSchema<SigId>("sig", value => typeof value === "number" ? sigId(value) : undefined, value => ({ kind: "signature", value }));

  const candSchema = scalarSchema<CandidateListId>("cand", value => typeof value === "number" ? candidateListId(value) : undefined);

  const defSchema = scalarSchema<DefId>("def", value => {
    if (typeof value !== "string") return undefined;
    const decoded = decodeDefId(value); return decoded.kind === "decoded" ? encodeDefId(decoded.value) : undefined;
  }, value => ({ kind: "definition", value }));

  const bodySchema = scalarSchema<BodyId>("body", value => {
    if (typeof value !== "string") return undefined;
    const decoded = decodeBodyId(value); return decoded.kind === "decoded" ? encodeBodyId(decoded.value) : undefined;
  });

  const groupSchema = scalarSchema<GroupId>("group", value => {
    if (typeof value !== "string") return undefined;
    const decoded = decodeGroupId(value); return decoded.kind === "decoded" ? encodeGroupId([decoded.value]) : undefined;
  });

  const modSchema = scalarSchema<ModuleId>("mod", value => {
    if (typeof value !== "string") return undefined;
    const decoded = decodeModuleId(value); return decoded.kind === "decoded" ? encodeModuleId(decoded.value) : undefined;
  });

  const expSchema = scalarSchema<ExpansionId>("exp", value => typeof value === "string" ? expansionId(value) : undefined);

  const nodeRefSchema = recordSchema<NodeRef>("NodeRef", "NodeRef", read => {
    const body = read("body", () => bodySchema, value => value.body);
    const node = read("node", () => nSchema, value => value.node);
    return { fields: [body, node], value: () => ({ body: body.value(), node: node.value() }) };
  }, value => ({ kind: "node", value }));

  const itemNodeRefSchema = recordSchema<ItemNodeRef>("ItemNodeRef", "ItemNodeRef", read => {
    const owner = read("owner", () => defSchema, value => value.owner);
    const node = read("node", () => nSchema, value => value.node);
    return { fields: [owner, node], value: () => ({ owner: owner.value(), node: node.value() }) };
  }, value => ({ kind: "item", value }));

  const sourceNodeRefSchema: RecordSchema<SourceNodeRef> = unionSchema<SourceNodeRef>("SourceNodeRef",
    () => [bodySourceSchema, itemSourceSchema], value => {
    switch (value.kind) {
      case "body": return bodySourceSchema.stage(value);
      case "item": return itemSourceSchema.stage(value);
    }
  });

  const bodySourceSchema = recordSchema<BodySourceRecord>("BodySource", "body", read => {
    const value = read("value", () => nodeRefSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "body", value: value.value() }) };
  });

  const itemSourceSchema = recordSchema<ItemSourceRecord>("ItemSource", "item", read => {
    const value = read("value", () => itemNodeRefSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "item", value: value.value() }) };
  });

  const localRefSchema = recordSchema<LocalRef>("LocalRef", "LocalRef", read => {
    const body = read("body", () => bodySchema, value => value.body);
    const local = read("local", () => lSchema, value => value.local);
    return { fields: [body, local], value: () => ({ body: body.value(), local: local.value() }) };
  }, value => ({ kind: "local", value }));

  const originSchema = recordSchema<Origin>("Origin", "Origin", read => {
    const module = read("module", () => modSchema, value => value.module);
    const start = read("start", () => numberSchema, value => value.start);
    const length = read("length", () => numberSchema, value => value.length);
    const derived = read("derived", () => arraySchema(derivationSchema), value => value.derived);
    return { fields: [module, start, length, derived], value: () => ({ module: module.value(), start: start.value(), length: length.value(), derived: derived.value() }) };
  });

  const derivationSchema: RecordSchema<Derivation> = unionSchema<Derivation>("Derivation",
    () => [loweringDerivationSchema, expansionDerivationSchema], value => {
    switch (value.kind) {
      case "lowering": return loweringDerivationSchema.stage(value);
      case "expansion": return expansionDerivationSchema.stage(value);
    }
  });

  const loweringDerivationSchema = recordSchema<LoweringDerivationRecord>("LoweringDerivation", "lowering", read => {
    const pass = read("pass", () => passNameSchema, value => value.pass);
    return { fields: [pass], value: () => ({ kind: "lowering", pass: pass.value() }) };
  });

  const expansionDerivationSchema = recordSchema<ExpansionDerivationRecord>("ExpansionDerivation", "expansion", read => {
    const expansion = read("expansion", () => expSchema, value => value.expansion);
    return { fields: [expansion], value: () => ({ kind: "expansion", expansion: expansion.value() }) };
  });

  const passNameSchema = enumSchema("PassName", ["front","decls","infer","elaborate","validate","lower-mir","evaluate","metadata","liveness","initialization","refinements","origins","suspension","errorStorage","pointerBacking","summaries","pipeline"]);

  const typeParameterIdentitySchema = recordSchema<TypeParameterIdentity>("TypeParameterIdentity", "TypeParameterIdentity", read => {
    const owner = read("owner", () => defSchema, value => value.owner);
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [owner, index], value: () => ({ owner: owner.value(), index: index.value() }) };
  });

  const bindingVectorSchema = recordSchema<BindingVector>("BindingVector", "BindingVector", read => {
    const classBindings = read("classBindings", () => arraySchema(typeBindingSchema), value => value.classBindings);
    const methodBindings = read("methodBindings", () => arraySchema(typeBindingSchema), value => value.methodBindings);
    const capturedBindings = read("capturedBindings", () => arraySchema(typeBindingSchema), value => value.capturedBindings);
    const selfBindings = read("selfBindings", () => arraySchema(selfBindingSchema), value => value.selfBindings);
    return { fields: [classBindings, methodBindings, capturedBindings, selfBindings], value: () => ({ classBindings: classBindings.value(), methodBindings: methodBindings.value(), capturedBindings: capturedBindings.value(), selfBindings: selfBindings.value() }) };
  });

  const typeBindingSchema: RecordSchema<TypeBinding> = unionSchema<TypeBinding>("TypeBinding",
    () => [boundTypeSchema, rigidTypeSchema], value => {
    switch (value.kind) {
      case "bound": return boundTypeSchema.stage(value);
      case "rigid": return rigidTypeSchema.stage(value);
    }
  });

  const boundTypeSchema = recordSchema<BoundTypeRecord>("BoundType", "bound", read => {
    const parameter = read("parameter", () => typeParameterIdentitySchema, value => value.parameter);
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [parameter, type], value: () => ({ kind: "bound", parameter: parameter.value(), type: type.value() }) };
  });

  const rigidTypeSchema = recordSchema<RigidTypeRecord>("RigidType", "rigid", read => {
    const parameter = read("parameter", () => typeParameterIdentitySchema, value => value.parameter);
    return { fields: [parameter], value: () => ({ kind: "rigid", parameter: parameter.value() }) };
  });

  const selfBindingSchema: RecordSchema<SelfBinding> = unionSchema<SelfBinding>("SelfBinding",
    () => [boundSelfSchema, rigidSelfSchema], value => {
    switch (value.kind) {
      case "bound": return boundSelfSchema.stage(value);
      case "rigid": return rigidSelfSchema.stage(value);
    }
  });

  const boundSelfSchema = recordSchema<BoundSelfRecord>("BoundSelf", "bound", read => {
    const owner = read("owner", () => defSchema, value => value.owner);
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [owner, type], value: () => ({ kind: "bound", owner: owner.value(), type: type.value() }) };
  });

  const rigidSelfSchema = recordSchema<RigidSelfRecord>("RigidSelf", "rigid", read => {
    const owner = read("owner", () => defSchema, value => value.owner);
    return { fields: [owner], value: () => ({ kind: "rigid", owner: owner.value() }) };
  });

  const exactRationalSchema = recordSchema<ExactRational>("ExactRational", "ExactRational", read => {
    const numerator = read("numerator", () => bigintSchema, value => value.numerator);
    const denominator = read("denominator", () => bigintSchema, value => value.denominator);
    const negativeZero = read("negativeZero", () => booleanSchema, value => value.negativeZero);
    return { fields: [numerator, denominator, negativeZero], value: () => ({ numerator: numerator.value(), denominator: denominator.value(), negativeZero: negativeZero.value() }) };
  });

  const literalValueSchema: RecordSchema<LiteralValue> = unionSchema<LiteralValue>("LiteralValue",
    () => [numberLiteralSchema, bigintLiteralSchema, stringLiteralSchema, booleanLiteralSchema, absenceLiteralSchema, symbolLiteralSchema], value => {
    switch (value.kind) {
      case "number": return numberLiteralSchema.stage(value);
      case "bigint": return bigintLiteralSchema.stage(value);
      case "string": return stringLiteralSchema.stage(value);
      case "boolean": return booleanLiteralSchema.stage(value);
      case "absence": return absenceLiteralSchema.stage(value);
      case "unique-symbol": return symbolLiteralSchema.stage(value);
    }
  });

  const numberLiteralSchema = recordSchema<NumberLiteralRecord>("NumberLiteral", "number", read => {
    const token = read("token", () => stringSchema, value => value.token);
    const value = read("value", () => exactRationalSchema, value => value.value);
    return { fields: [token, value], value: () => ({ kind: "number", token: token.value(), value: value.value() }) };
  });

  const bigintLiteralSchema = recordSchema<BigintLiteralRecord>("BigintLiteral", "bigint", read => {
    const token = read("token", () => stringSchema, value => value.token);
    const value = read("value", () => bigintSchema, value => value.value);
    return { fields: [token, value], value: () => ({ kind: "bigint", token: token.value(), value: value.value() }) };
  });

  const stringLiteralSchema = recordSchema<StringLiteralRecord>("StringLiteral", "string", read => {
    const value = read("value", () => stringSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "string", value: value.value() }) };
  });

  const booleanLiteralSchema = recordSchema<BooleanLiteralRecord>("BooleanLiteral", "boolean", read => {
    const value = read("value", () => booleanSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "boolean", value: value.value() }) };
  });

  const absenceLiteralSchema = recordSchema<AbsenceLiteralRecord>("AbsenceLiteral", "absence", () => {
    return { fields: [], value: () => ({ kind: "absence" }) };
  });

  const symbolLiteralSchema = recordSchema<SymbolLiteralRecord>("SymbolLiteral", "unique-symbol", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "unique-symbol", declaration: declaration.value() }) };
  });

  const memberKeySchema: RecordSchema<MemberKey> = unionSchema<MemberKey>("MemberKey",
    () => [textKeySchema, numberKeySchema, symbolKeySchema], value => {
    switch (value.kind) {
      case "text": return textKeySchema.stage(value);
      case "number": return numberKeySchema.stage(value);
      case "symbol": return symbolKeySchema.stage(value);
    }
  });

  const textKeySchema = recordSchema<TextKeyRecord>("TextKey", "text", read => {
    const value = read("value", () => stringSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "text", value: value.value() }) };
  });

  const numberKeySchema = recordSchema<NumberKeyRecord>("NumberKey", "number", read => {
    const value = read("value", () => exactRationalSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "number", value: value.value() }) };
  });

  const symbolKeySchema = recordSchema<SymbolKeyRecord>("SymbolKey", "symbol", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "symbol", declaration: declaration.value() }) };
  });

  const memberOriginSchema: RecordSchema<MemberOrigin> = unionSchema<MemberOrigin>("MemberOrigin",
    () => [declaredOriginSchema, prototypeOriginSchema, mappedOriginSchema], value => {
    switch (value.kind) {
      case "declared": return declaredOriginSchema.stage(value);
      case "class-prototype": return prototypeOriginSchema.stage(value);
      case "mapped": return mappedOriginSchema.stage(value);
    }
  });

  const declaredOriginSchema = recordSchema<DeclaredOriginRecord>("DeclaredOrigin", "declared", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "declared", declaration: declaration.value() }) };
  });

  const prototypeOriginSchema = recordSchema<PrototypeOriginRecord>("PrototypeOrigin", "class-prototype", read => {
    const owner = read("owner", () => defSchema, value => value.owner);
    return { fields: [owner], value: () => ({ kind: "class-prototype", owner: owner.value() }) };
  });

  const mappedOriginSchema = recordSchema<MappedOriginRecord>("MappedOrigin", "mapped", read => {
    const owner = read("owner", () => sourceNodeRefSchema, value => value.owner);
    const key = read("key", () => memberKeySchema, value => value.key);
    return { fields: [owner, key], value: () => ({ kind: "mapped", owner: owner.value(), key: key.value() }) };
  });

  const passingModeSchema = enumSchema("PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]);

  const hostCodeNameSchema = scalarSchema<HostDiagnosticCode>("string",
    value => typeof value === "string" ? hostDiagnosticCode(value) : undefined);
  return { numberSchema, bigintSchema, stringSchema, booleanSchema, nSchema, lSchema, tSchema, sigSchema, candSchema, defSchema, bodySchema, groupSchema, modSchema, expSchema, nodeRefSchema, itemNodeRefSchema, sourceNodeRefSchema, bodySourceSchema, itemSourceSchema, localRefSchema, originSchema, derivationSchema, loweringDerivationSchema, expansionDerivationSchema, passNameSchema, typeParameterIdentitySchema, bindingVectorSchema, typeBindingSchema, boundTypeSchema, rigidTypeSchema, selfBindingSchema, boundSelfSchema, rigidSelfSchema, exactRationalSchema, literalValueSchema, numberLiteralSchema, bigintLiteralSchema, stringLiteralSchema, booleanLiteralSchema, absenceLiteralSchema, symbolLiteralSchema, memberKeySchema, textKeySchema, numberKeySchema, symbolKeySchema, memberOriginSchema, declaredOriginSchema, prototypeOriginSchema, mappedOriginSchema, passingModeSchema, hostCodeNameSchema };
}

