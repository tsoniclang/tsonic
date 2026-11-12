import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import type * as Diag from "../diag/contract.js";
import type { HirReader } from "./text-construction.js";
import { constructionValue, stringReader, numberReader, bigintReader, booleanReader, nullReader, literalReader } from "./text-construction.js";
import { hostDiagnosticCode } from "../diag/index.js";
export interface HirScalarReaders {
  readonly scalar_string: HirReader<string>;
  readonly scalar_number: HirReader<number>;
  readonly scalar_bigint: HirReader<bigint>;
  readonly scalar_boolean: HirReader<boolean>;
  readonly scalar_null: HirReader<null>;
  readonly scalar_diagnostic: HirReader<Diag.HostDiagnosticCode>;
  readonly identity_mod: HirReader<Ids.ModuleId>;
  readonly identity_def: HirReader<Ids.DefId>;
  readonly identity_body: HirReader<Ids.BodyId>;
  readonly identity_exp: HirReader<Ids.ExpansionId>;
  readonly identity_n: HirReader<Ids.NodeId>;
  readonly identity_l: HirReader<Ids.LocalId>;
  readonly identity_t: HirReader<Ids.TyId>;
  readonly identity_sig: HirReader<Ids.SigId>;
  readonly identity_cand: HirReader<Ids.CandidateListId>;
  readonly literal_0: HirReader<"default" | "optional" | "required" | "rest" | "this">;
  readonly literal_1: HirReader<Types.PassingMode>;
  readonly literal_2: HirReader<"binding" | "capture" | "catch" | "parameter">;
  readonly literal_3: HirReader<"checker-error" | "not-provided" | "parameter-dependent">;
  readonly literal_4: HirReader<Diag.Severity>;
  readonly literal_5: HirReader<Ids.PassName>;
  readonly literal_6: HirReader<"argument" | "context" | "receiver" | "result" | "type-argument">;
  readonly literal_7: HirReader<"authored" | "inferred">;
  readonly literal_8: HirReader<"!">;
  readonly literal_9: HirReader<"+">;
  readonly literal_10: HirReader<"-">;
  readonly literal_11: HirReader<"delete">;
  readonly literal_12: HirReader<"typeof">;
  readonly literal_13: HirReader<"void">;
  readonly literal_14: HirReader<"~">;
  readonly literal_15: HirReader<"!=">;
  readonly literal_16: HirReader<"!==">;
  readonly literal_17: HirReader<"%">;
  readonly literal_18: HirReader<"&">;
  readonly literal_19: HirReader<"*">;
  readonly literal_20: HirReader<"**">;
  readonly literal_21: HirReader<"/">;
  readonly literal_22: HirReader<"<">;
  readonly literal_23: HirReader<"<<">;
  readonly literal_24: HirReader<"<=">;
  readonly literal_25: HirReader<"==">;
  readonly literal_26: HirReader<"===">;
  readonly literal_27: HirReader<">">;
  readonly literal_28: HirReader<">=">;
  readonly literal_29: HirReader<">>">;
  readonly literal_30: HirReader<">>>">;
  readonly literal_31: HirReader<"^">;
  readonly literal_32: HirReader<"in">;
  readonly literal_33: HirReader<"instanceof">;
  readonly literal_34: HirReader<"|">;
  readonly literal_35: HirReader<Hir.SyntaxFlag>;
  readonly literal_36: HirReader<"readonly" | "readwrite" | "unspecified">;
  readonly literal_37: HirReader<"typed-location">;
  readonly literal_38: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_39: HirReader<"applicable" | "conditional-candidates" | "untyped" | "unvisited">;
  readonly literal_40: HirReader<"available" | "missing" | "not-applicable" | "unvisited">;
  readonly literal_41: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_42: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_43: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_44: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_45: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_46: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_47: HirReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly literal_48: HirReader<"view">;
  readonly literal_49: HirReader<"native-pointer">;
  readonly literal_50: HirReader<"load">;
  readonly literal_51: HirReader<"store">;
  readonly literal_52: HirReader<"offset">;
  readonly literal_53: HirReader<"raw-address">;
  readonly literal_54: HirReader<"bind-raw-pointer">;
  readonly literal_55: HirReader<"equal-raw-pointer">;
  readonly literal_56: HirReader<"hash-raw-pointer">;
  readonly literal_57: HirReader<"raw-memory">;
  readonly literal_58: HirReader<"to-raw">;
  readonly literal_59: HirReader<"reinterpret">;
  readonly literal_60: HirReader<"byte-offset">;
  readonly literal_61: HirReader<"bigint" | "number">;
  readonly literal_62: HirReader<"signed" | "unsigned">;
  readonly literal_63: HirReader<8 | 16 | 32 | 64 | 128>;
  readonly literal_64: HirReader<"raw-to-address-integer">;
  readonly literal_65: HirReader<32>;
  readonly literal_66: HirReader<"number">;
  readonly literal_67: HirReader<"unsigned">;
  readonly literal_68: HirReader<64>;
  readonly literal_69: HirReader<"bigint">;
  readonly literal_70: HirReader<"address-integer-to-raw">;
  readonly literal_71: HirReader<"keep-alive">;
  readonly literal_72: HirReader<"method">;
  readonly literal_73: HirReader<"property">;
  readonly literal_74: HirReader<"constructor">;
  readonly literal_75: HirReader<"declaration">;
  readonly literal_76: HirReader<"unsafe-context">;
  readonly literal_77: HirReader<"expression">;
  readonly literal_78: HirReader<"remaining-block">;
  readonly literal_79: HirReader<"safety">;
  readonly literal_80: HirReader<"root">;
  readonly literal_81: HirReader<"type" | "value">;
  readonly literal_82: HirReader<"select-member">;
  readonly literal_83: HirReader<"indexer" | "method" | "property">;
  readonly literal_84: HirReader<"function-shape" | "member-evidence" | "receiver">;
  readonly literal_85: HirReader<"placement">;
  readonly literal_86: HirReader<"constructor" | "declaration" | "getter" | "setter">;
  readonly literal_87: HirReader<"apply">;
  readonly literal_88: HirReader<"requires-unsafe" | "safe">;
  readonly literal_89: HirReader<"argument">;
  readonly literal_90: HirReader<"borrowed-mut">;
  readonly literal_91: HirReader<"borrowed-shared">;
  readonly literal_92: HirReader<"moved">;
  readonly literal_93: HirReader<"value">;
  readonly literal_94: HirReader<"project">;
  readonly literal_95: HirReader<"library">;
  readonly literal_96: HirReader<"big" | "little">;
  readonly literal_97: HirReader<32 | 64>;
  readonly literal_98: HirReader<"alignment" | "field-offset" | "size" | "stride">;
  readonly literal_99: HirReader<"assignment-pattern">;
  readonly literal_100: HirReader<Hir.TokenFlag>;
  readonly literal_101: HirReader<"property-name">;
  readonly literal_102: HirReader<"declaration-name">;
  readonly literal_103: HirReader<"type-literal">;
  readonly literal_104: HirReader<"module-specifier">;
  readonly literal_105: HirReader<"export-name">;
  readonly literal_106: HirReader<"attribute-value">;
  readonly literal_107: HirReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">;
  readonly literal_108: HirReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">;
  readonly literal_109: HirReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">;
  readonly literal_110: HirReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">;
  readonly literal_111: HirReader<"assignment">;
  readonly literal_112: HirReader<"advertised" | "api-body" | "api-signature">;
  readonly literal_113: HirReader<"extends" | "implements">;
  readonly literal_114: HirReader<"assignment-target">;
  readonly literal_115: HirReader<"read-write" | "write">;
  readonly literal_116: HirReader<"heritage">;
  readonly literal_117: HirReader<"ExtendsKeyword" | "ImplementsKeyword">;
  readonly literal_118: HirReader<"type-name">;
  readonly literal_119: HirReader<"label">;
  readonly literal_120: HirReader<"private-name">;
  readonly literal_121: HirReader<"shorthand-value">;
  readonly literal_122: HirReader<"AssertKeyword" | "WithKeyword">;
  readonly literal_123: HirReader<"DeferKeyword">;
  readonly literal_124: HirReader<"TypeKeyword">;
  readonly literal_125: HirReader<"ImportKeyword" | "NewKeyword">;
  readonly literal_126: HirReader<"ModuleKeyword" | "NamespaceKeyword">;
  readonly literal_127: HirReader<"MinusMinusToken" | "PlusPlusToken">;
  readonly literal_128: HirReader<"update">;
  readonly literal_129: HirReader<"ExclamationToken" | "MinusMinusToken" | "MinusToken" | "PlusPlusToken" | "PlusToken" | "TildeToken">;
  readonly literal_130: HirReader<"JSX" | "Standard">;
  readonly literal_131: HirReader<"Deferred" | "External" | "JS" | "JSON" | "JSX" | "TS" | "TSX" | "Unknown">;
  readonly literal_132: HirReader<"KeyOfKeyword" | "ReadonlyKeyword" | "UniqueKeyword">;
}
export function createHirScalarReaders(): HirScalarReaders {
  return {
    scalar_string: stringReader(input => input),
    scalar_number: numberReader(),
    scalar_bigint: bigintReader(),
    scalar_boolean: booleanReader(),
    scalar_null: nullReader(),
    scalar_diagnostic: stringReader(hostDiagnosticCode),
    identity_mod: { requests: accept => [{ kind: "mod", read: value => accept(constructionValue(value)) }] },
    identity_def: { requests: accept => [{ kind: "def", read: value => accept(constructionValue(value)) }] },
    identity_body: { requests: accept => [{ kind: "body", read: value => accept(constructionValue(value)) }] },
    identity_exp: { requests: accept => [{ kind: "exp", read: value => accept(constructionValue(value)) }] },
    identity_n: { requests: accept => [{ kind: "n", read: value => accept(constructionValue(value)) }] },
    identity_l: { requests: accept => [{ kind: "l", read: value => accept(constructionValue(value)) }] },
    identity_t: { requests: accept => [{ kind: "t", read: value => accept(constructionValue(value)) }] },
    identity_sig: { requests: accept => [{ kind: "sig", read: value => accept(constructionValue(value)) }] },
    identity_cand: { requests: accept => [{ kind: "cand", read: value => accept(constructionValue(value)) }] },
    literal_0: literalReader<"default" | "optional" | "required" | "rest" | "this">(["required","optional","default","rest","this"]),
    literal_1: literalReader<Types.PassingMode>(["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]),
    literal_2: literalReader<"binding" | "capture" | "catch" | "parameter">(["parameter","binding","capture","catch"]),
    literal_3: literalReader<"checker-error" | "not-provided" | "parameter-dependent">(["checker-error","parameter-dependent","not-provided"]),
    literal_4: literalReader<Diag.Severity>(["error","warning","suggestion"]),
    literal_5: literalReader<Ids.PassName>(["front","decls","infer","elaborate","validate","lower-mir","evaluate","metadata","liveness","initialization","refinements","origins","suspension","errorStorage","pointerBacking","summaries","pipeline"]),
    literal_6: literalReader<"argument" | "context" | "receiver" | "result" | "type-argument">(["argument","receiver","context","result","type-argument"]),
    literal_7: literalReader<"authored" | "inferred">(["authored","inferred"]),
    literal_8: literalReader<"!">(["!"]),
    literal_9: literalReader<"+">(["+"]),
    literal_10: literalReader<"-">(["-"]),
    literal_11: literalReader<"delete">(["delete"]),
    literal_12: literalReader<"typeof">(["typeof"]),
    literal_13: literalReader<"void">(["void"]),
    literal_14: literalReader<"~">(["~"]),
    literal_15: literalReader<"!=">(["!="]),
    literal_16: literalReader<"!==">(["!=="]),
    literal_17: literalReader<"%">(["%"]),
    literal_18: literalReader<"&">(["&"]),
    literal_19: literalReader<"*">(["*"]),
    literal_20: literalReader<"**">(["**"]),
    literal_21: literalReader<"/">(["/"]),
    literal_22: literalReader<"<">(["<"]),
    literal_23: literalReader<"<<">(["<<"]),
    literal_24: literalReader<"<=">(["<="]),
    literal_25: literalReader<"==">(["=="]),
    literal_26: literalReader<"===">(["==="]),
    literal_27: literalReader<">">([">"]),
    literal_28: literalReader<">=">([">="]),
    literal_29: literalReader<">>">([">>"]),
    literal_30: literalReader<">>>">([">>>"]),
    literal_31: literalReader<"^">(["^"]),
    literal_32: literalReader<"in">(["in"]),
    literal_33: literalReader<"instanceof">(["instanceof"]),
    literal_34: literalReader<"|">(["|"]),
    literal_35: literalReader<Hir.SyntaxFlag>(["Let","Const","Using","OptionalChain","DisallowInContext","YieldContext","DecoratorContext","AwaitContext","DisallowConditionalTypesContext","ThisNodeHasError","JavaScriptFile","ThisNodeOrAnySubNodesHasError","HasJSDoc","JSDoc","Ambient","InWithStatement","JsonFile","IdentifierHasExtendedUnicodeEscape","IdentifierIsInJSDocNamespace","NestedNamespace","AwaitUsing"]),
    literal_36: literalReader<"readonly" | "readwrite" | "unspecified">(["readonly","readwrite","unspecified"]),
    literal_37: literalReader<"typed-location">(["typed-location"]),
    literal_38: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["address-of"]),
    literal_39: literalReader<"applicable" | "conditional-candidates" | "untyped" | "unvisited">(["applicable","conditional-candidates","untyped","unvisited"]),
    literal_40: literalReader<"available" | "missing" | "not-applicable" | "unvisited">(["available","unvisited","not-applicable","missing"]),
    literal_41: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["allocate"]),
    literal_42: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["load"]),
    literal_43: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["store"]),
    literal_44: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["equal-pointer"]),
    literal_45: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["hash-pointer"]),
    literal_46: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["bind-pointer"]),
    literal_47: literalReader<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">(["project-pointer"]),
    literal_48: literalReader<"view">(["view"]),
    literal_49: literalReader<"native-pointer">(["native-pointer"]),
    literal_50: literalReader<"load">(["load"]),
    literal_51: literalReader<"store">(["store"]),
    literal_52: literalReader<"offset">(["offset"]),
    literal_53: literalReader<"raw-address">(["raw-address"]),
    literal_54: literalReader<"bind-raw-pointer">(["bind-raw-pointer"]),
    literal_55: literalReader<"equal-raw-pointer">(["equal-raw-pointer"]),
    literal_56: literalReader<"hash-raw-pointer">(["hash-raw-pointer"]),
    literal_57: literalReader<"raw-memory">(["raw-memory"]),
    literal_58: literalReader<"to-raw">(["to-raw"]),
    literal_59: literalReader<"reinterpret">(["reinterpret"]),
    literal_60: literalReader<"byte-offset">(["byte-offset"]),
    literal_61: literalReader<"bigint" | "number">(["number","bigint"]),
    literal_62: literalReader<"signed" | "unsigned">(["signed","unsigned"]),
    literal_63: literalReader<8 | 16 | 32 | 64 | 128>([8,16,32,64,128]),
    literal_64: literalReader<"raw-to-address-integer">(["raw-to-address-integer"]),
    literal_65: literalReader<32>([32]),
    literal_66: literalReader<"number">(["number"]),
    literal_67: literalReader<"unsigned">(["unsigned"]),
    literal_68: literalReader<64>([64]),
    literal_69: literalReader<"bigint">(["bigint"]),
    literal_70: literalReader<"address-integer-to-raw">(["address-integer-to-raw"]),
    literal_71: literalReader<"keep-alive">(["keep-alive"]),
    literal_72: literalReader<"method">(["method"]),
    literal_73: literalReader<"property">(["property"]),
    literal_74: literalReader<"constructor">(["constructor"]),
    literal_75: literalReader<"declaration">(["declaration"]),
    literal_76: literalReader<"unsafe-context">(["unsafe-context"]),
    literal_77: literalReader<"expression">(["expression"]),
    literal_78: literalReader<"remaining-block">(["remaining-block"]),
    literal_79: literalReader<"safety">(["safety"]),
    literal_80: literalReader<"root">(["root"]),
    literal_81: literalReader<"type" | "value">(["type","value"]),
    literal_82: literalReader<"select-member">(["select-member"]),
    literal_83: literalReader<"indexer" | "method" | "property">(["indexer","method","property"]),
    literal_84: literalReader<"function-shape" | "member-evidence" | "receiver">(["function-shape","receiver","member-evidence"]),
    literal_85: literalReader<"placement">(["placement"]),
    literal_86: literalReader<"constructor" | "declaration" | "getter" | "setter">(["declaration","constructor","getter","setter"]),
    literal_87: literalReader<"apply">(["apply"]),
    literal_88: literalReader<"requires-unsafe" | "safe">(["requires-unsafe","safe"]),
    literal_89: literalReader<"argument">(["argument"]),
    literal_90: literalReader<"borrowed-mut">(["borrowed-mut"]),
    literal_91: literalReader<"borrowed-shared">(["borrowed-shared"]),
    literal_92: literalReader<"moved">(["moved"]),
    literal_93: literalReader<"value">(["value"]),
    literal_94: literalReader<"project">(["project"]),
    literal_95: literalReader<"library">(["library"]),
    literal_96: literalReader<"big" | "little">(["little","big"]),
    literal_97: literalReader<32 | 64>([32,64]),
    literal_98: literalReader<"alignment" | "field-offset" | "size" | "stride">(["size","alignment","stride","field-offset"]),
    literal_99: literalReader<"assignment-pattern">(["assignment-pattern"]),
    literal_100: literalReader<Hir.TokenFlag>(["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]),
    literal_101: literalReader<"property-name">(["property-name"]),
    literal_102: literalReader<"declaration-name">(["declaration-name"]),
    literal_103: literalReader<"type-literal">(["type-literal"]),
    literal_104: literalReader<"module-specifier">(["module-specifier"]),
    literal_105: literalReader<"export-name">(["export-name"]),
    literal_106: literalReader<"attribute-value">(["attribute-value"]),
    literal_107: literalReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">(["arithmetic"]),
    literal_108: literalReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">(["comparison"]),
    literal_109: literalReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">(["short-circuit"]),
    literal_110: literalReader<"arithmetic" | "comparison" | "sequence" | "short-circuit">(["sequence"]),
    literal_111: literalReader<"assignment">(["assignment"]),
    literal_112: literalReader<"advertised" | "api-body" | "api-signature">(["advertised","api-signature","api-body"]),
    literal_113: literalReader<"extends" | "implements">(["extends","implements"]),
    literal_114: literalReader<"assignment-target">(["assignment-target"]),
    literal_115: literalReader<"read-write" | "write">(["write","read-write"]),
    literal_116: literalReader<"heritage">(["heritage"]),
    literal_117: literalReader<"ExtendsKeyword" | "ImplementsKeyword">(["ExtendsKeyword","ImplementsKeyword"]),
    literal_118: literalReader<"type-name">(["type-name"]),
    literal_119: literalReader<"label">(["label"]),
    literal_120: literalReader<"private-name">(["private-name"]),
    literal_121: literalReader<"shorthand-value">(["shorthand-value"]),
    literal_122: literalReader<"AssertKeyword" | "WithKeyword">(["WithKeyword","AssertKeyword"]),
    literal_123: literalReader<"DeferKeyword">(["DeferKeyword"]),
    literal_124: literalReader<"TypeKeyword">(["TypeKeyword"]),
    literal_125: literalReader<"ImportKeyword" | "NewKeyword">(["ImportKeyword","NewKeyword"]),
    literal_126: literalReader<"ModuleKeyword" | "NamespaceKeyword">(["ModuleKeyword","NamespaceKeyword"]),
    literal_127: literalReader<"MinusMinusToken" | "PlusPlusToken">(["PlusPlusToken","MinusMinusToken"]),
    literal_128: literalReader<"update">(["update"]),
    literal_129: literalReader<"ExclamationToken" | "MinusMinusToken" | "MinusToken" | "PlusPlusToken" | "PlusToken" | "TildeToken">(["PlusToken","MinusToken","TildeToken","ExclamationToken","PlusPlusToken","MinusMinusToken"]),
    literal_130: literalReader<"JSX" | "Standard">(["Standard","JSX"]),
    literal_131: literalReader<"Deferred" | "External" | "JS" | "JSON" | "JSX" | "TS" | "TSX" | "Unknown">(["Unknown","JS","JSX","TS","TSX","External","JSON","Deferred"]),
    literal_132: literalReader<"KeyOfKeyword" | "ReadonlyKeyword" | "UniqueKeyword">(["KeyOfKeyword","ReadonlyKeyword","UniqueKeyword"]),
  };
}
