/**
 * Core emitter types
 */

import type {
  BindingRegistry as FrontendBindingRegistry,
  SurfaceCapabilities,
  TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import type {
  IrModule,
  IrType,
  IrExpression,
  IrInterfaceMember,
  IrClassMember,
} from "@tsonic/frontend";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { RuntimeUnionRegistry } from "../core/semantic/runtime-union-registry.js";
import type {
  SemanticType,
  StorageCarrier,
} from "../core/semantic/type-domains.js";

/**
 * Module identity for import resolution
 */
export type ModuleIdentity = {
  readonly namespace: string;
  readonly className: string;
  readonly filePath: string;
  /** True when this module emits a static module container class. */
  readonly hasRuntimeContainer: boolean;
  /**
   * True if the module's static container needs the __Module suffix.
   * When true, value imports should target ClassName__Module instead of ClassName.
   */
  readonly hasTypeCollision: boolean;
  /**
   * Exported value kind index for this module (by exported name).
   * Used to select namingPolicy bucket for value imports.
   */
  readonly exportedValueKinds?: ReadonlyMap<string, "function" | "variable">;
  /**
   * Call arities that can omit trailing authored arguments at runtime.
   *
   * Key: exported value name
   * Value: supported argument counts for direct invocation without emitter-
   * synthesized default/rest materialization.
   */
  readonly exportedValueCallArities?: ReadonlyMap<string, readonly number[]>;
  /**
   * Local type index for this module.
   *
   * Used for import resolution of local type aliases:
   * - structural aliases (objectType) import as `${Name}__Alias`
   * - non-structural aliases are erased to their underlying type at emission time
   */
  readonly localTypes?: ReadonlyMap<string, LocalTypeInfo>;
  /**
   * Local type declarations that must be public because they are exported
   * directly or reachable from an exported API surface in this module.
   */
  readonly publicLocalTypes?: ReadonlySet<string>;
};

/**
 * Module map for resolving cross-file imports
 */
export type ModuleMap = ReadonlyMap<string, ModuleIdentity>;

/**
 * Export source: where an export actually comes from
 * Used to resolve re-exports to their original source
 */
export type ExportSource = {
  /** Canonical file path of the actual source */
  readonly sourceFile: string;
  /** Name of the export in the source file */
  readonly sourceName: string;
};

/**
 * Map from (moduleFilePath, exportName) to actual source
 * Key format: "moduleFilePath:exportName"
 */
export type ExportMap = ReadonlyMap<string, ExportSource>;

export type TypeMemberKind = "method" | "property" | "field" | "enumMember";

/**
 * Index of member kinds for locally-emitted types.
 *
 * Key: fully-qualified type name (without global::), e.g. "MyApp.Models.User"
 * Value: map from original TS member name to its kind ("method" | "property" | "field" | "enumMember")
 */
export type TypeMemberIndex = ReadonlyMap<
  string,
  ReadonlyMap<string, TypeMemberKind>
>;

export type TypeAliasIndexEntry = {
  /** Fully-qualified type name (without global::), e.g. "MyApp.Models.Result" */
  readonly fqn: string;
  /** Unqualified alias name, e.g. "Result" */
  readonly name: string;
  /** Underlying IR type of the alias */
  readonly type: IrType;
  /** Type parameter names (in order) */
  readonly typeParameters: readonly string[];
};

/**
 * Cross-module type alias index.
 *
 * The frontend may preserve type aliases in inferredType (as referenceType by alias name)
 * even when the alias is declared in a different module. The emitter needs to resolve
 * such aliases deterministically for source-owned runtime union carriers.
 */
export type TypeAliasIndex = {
  /** Lookup by fully-qualified alias name. */
  readonly byFqn: ReadonlyMap<string, TypeAliasIndexEntry>;
};

/**
 * Options for C# code generation
 */
export type EmitterOptions = {
  /** Surface mode used during frontend compilation. */
  readonly surface?: string;
  readonly surfaceCapabilities?: SurfaceCapabilities;
  /** Root namespace for the application */
  readonly rootNamespace: string;
  /**
   * Cross-module synthetic type namespace map (compiler-generated only).
   *
   * Used for types declared in synthetic IR modules (e.g. `__tsonic/*`) that
   * do not appear in a given module's localTypes, but are still part of the
   * final compilation unit.
   *
   * Key: unqualified type name (e.g. "__Anon_abcd_1234abcd")
   * Value: declaring namespace (e.g. "MyApp")
   */
  readonly syntheticTypeNamespaces?: ReadonlyMap<string, string>;
  /** Member-kind index for locally-emitted types (populated during batch emission) */
  readonly typeMemberIndex?: TypeMemberIndex;
  /** Cross-module type alias index (populated during batch emission) */
  readonly typeAliasIndex?: TypeAliasIndex;
  /** Whether to include source map comments */
  readonly includeSourceMaps?: boolean;
  /** Indentation style (spaces) */
  readonly indent?: number;
  /** Maximum line length */
  readonly maxLineLength?: number;
  /** Include timestamp in generated files */
  readonly includeTimestamp?: boolean;
  /** Whether this module is an entry point (needs Main method) */
  readonly isEntryPoint?: boolean;
  /** Entry point file path (for batch emit) */
  readonly entryPointPath?: string;
  /** Current module file path being emitted (for import-path-sensitive lowering). */
  readonly currentModuleFilePath?: string;
  /** Type roots used by the frontend to discover CLR bindings (informational; emitter does not load directly). */
  readonly libraries?: readonly string[];
  /** Module map for resolving cross-file imports (populated during batch emission) */
  readonly moduleMap?: ModuleMap;
  /** Export map for resolving re-exports to actual source (populated during batch emission) */
  readonly exportMap?: ExportMap;
  /**
   * Modules available for semantic cross-module resolution even when they are
   * intentionally omitted from the current emitted source closure.
   */
  readonly referenceModules?: readonly IrModule[];
  /**
   * Type declarations to suppress during emission.
   * Key format: "<filePath>::<statementKind>::<typeName>".
   */
  readonly suppressedTypeDeclarations?: ReadonlySet<string>;
  /**
   * Canonical local structural type targets.
   *
   * Some non-exported structural declarations are deduplicated across modules
   * to preserve TypeScript structural assignability in generated C#.
   *
   * Key format: "<namespace>::<typeName>"
   * Value format: fully-qualified CLR name (without global::), e.g. "MyApp.repo.ItemShape"
   */
  readonly canonicalLocalTypeTargets?: ReadonlyMap<string, string>;
  /** JSON AOT registry for collecting types used with JsonSerializer (shared across modules) */
  readonly jsonAotRegistry?: JsonAotRegistry;
  /** Registry of compiler-owned runtime union carrier definitions (shared across modules). */
  readonly runtimeUnionRegistry?: RuntimeUnionRegistry;
  /**
   * Enable NativeAOT JSON context generation/rewrite.
   *
   * When false, JsonSerializer calls are emitted without `TsonicJson.Options`
   * and no `__tsonic_json.g.cs` file is generated.
   */
  readonly enableJsonAot?: boolean;
  /**
   * Pre-loaded CLR bindings from frontend (for Action/Func resolution).
   * When provided, these take precedence over loading from library directories.
   * The map keys are TypeScript emit names (e.g., "Action", "List").
   * Values must have either `clrName` or `name` property containing the CLR type name.
   */
  readonly clrBindings?: ReadonlyMap<string, FrontendTypeBinding>;
  /** Full frontend binding registry for exact source/global/module binding lookups during emission. */
  readonly bindingRegistry?: FrontendBindingRegistry;
};

/**
 * Import binding information for qualifying imported identifiers.
 * Local module imports are always emitted as fully-qualified references
 * to avoid C# name ambiguity.
 *
 * All CLR name resolution is done in the frontend - the emitter just uses
 * the pre-computed clrName directly (no string parsing or type lookup).
 */
export type ImportBinding =
  | {
      /** Type import (class/interface/enum/erased alias) */
      readonly kind: "type";
      /** Fully-qualified or keyword-preserving type AST */
      readonly typeAst: CSharpTypeAst;
      /**
       * Exact imported type-alias body when the imported symbol is a type alias.
       * This lets semantic helpers resolve imported aliases deterministically
       * from the import contract instead of guessing by leaf name.
       */
      readonly aliasType?: IrType;
      /** Declared type parameters for aliasType when present. */
      readonly aliasTypeParameters?: readonly string[];
    }
  | {
      /** Value import (function/variable) */
      readonly kind: "value";
      /**
       * Fully-qualified CLR container name.
       * Example: "global::MultiFileTypes.models.user"
       */
      readonly clrName: string;
      /** Member name inside the container (e.g. "createUser") */
      readonly member: string;
      /** Original exported value category when known (function vs variable/function-value). */
      readonly valueKind?: ValueSymbolKind;
      /** Type surface for class/enum values that are also valid in type positions. */
      readonly typeAst?: CSharpTypeAst;
      /** True when this value comes from a module-object/source-surface export. */
      readonly moduleObject?: boolean;
      /** Supported argument counts that can omit trailing args at runtime. */
      readonly runtimeOmittableCallArities?: readonly number[];
    }
  | {
      /** Namespace/module-object import (import * as x / canonical module object) */
      readonly kind: "namespace";
      /** Fully-qualified CLR container/type name */
      readonly clrName: string;
      /** Exported value categories for namespace members when known. */
      readonly memberKinds?: ReadonlyMap<string, ValueSymbolKind>;
      /** Runtime-omittable call arities for namespace members when known. */
      readonly memberCallArities?: ReadonlyMap<string, readonly number[]>;
      /** True when this namespace represents a module-object/source-surface container. */
      readonly moduleObject?: boolean;
    };

/**
 * Information about a locally-defined type (class/interface/typeAlias).
 * Used for property type lookup during expression emission.
 */
export type LocalTypeInfo =
  | {
      readonly kind: "interface";
      readonly isExported?: boolean;
      readonly typeParameters: readonly string[];
      readonly members: readonly IrInterfaceMember[];
      readonly extends: readonly IrType[];
    }
  | {
      readonly kind: "class";
      readonly isExported?: boolean;
      readonly typeParameters: readonly string[];
      readonly members: readonly IrClassMember[];
      readonly superClass?: IrType;
      readonly implements: readonly IrType[];
    }
  | {
      readonly kind: "enum";
      readonly isExported?: boolean;
      readonly members: readonly string[];
    }
  | {
      readonly kind: "typeAlias";
      readonly isExported?: boolean;
      readonly typeParameters: readonly string[];
      readonly type: IrType;
    };

/**
 * Narrowed binding for union type narrowing.
 * - "rename": Used in if-statements where we can declare a temp var (e.g., account -> account__1_1)
 * - "expr": Used in ternary expressions where we inline the AsN() call (e.g., account -> (account.As1()))
 */
export type NarrowedBinding =
  | {
      readonly kind: "rename";
      readonly name: string;
      readonly type?: IrType;
      readonly sourceType?: IrType;
    }
  | {
      readonly kind: "expr";
      readonly exprAst: CSharpExpressionAst;
      readonly storageExprAst?: CSharpExpressionAst;
      readonly carrierExprAst?: CSharpExpressionAst;
      readonly carrierType?: IrType;
      readonly storageType?: IrType;
      readonly type?: IrType;
      readonly sourceType?: IrType;
    }
  | {
      readonly kind: "runtimeSubset";
      readonly runtimeMemberNs: readonly number[];
      readonly runtimeUnionArity: number;
      readonly storageExprAst?: CSharpExpressionAst;
      readonly sourceMembers?: readonly IrType[];
      readonly sourceCandidateMemberNs?: readonly number[];
      readonly type?: IrType;
      readonly sourceType?: IrType;
    };

export type ValueSymbolKind = "function" | "variable";

export type ValueSymbolInfo = {
  readonly kind: ValueSymbolKind;
  readonly csharpName: string;
  readonly type?: Extract<IrType, { kind: "functionType" }>;
};

/**
 * Context passed through emission process
 */
export type EmitterContext = {
  /** Current indentation level */
  readonly indentLevel: number;
  /** Options for emission */
  readonly options: EmitterOptions;
  /** Whether currently in static context */
  readonly isStatic: boolean;
  /** Whether currently in async context */
  readonly isAsync: boolean;
  /** Whether currently emitting an array index (omit .0 from integer literals) */
  readonly isArrayIndex?: boolean;
  /** Current class name (for constructor emission) */
  readonly className?: string;
  /** Original TS type declaration name currently being emitted. */
  readonly declaringTypeName?: string;
  /** Source names of the current declaring type's type parameters, in declaration order. */
  readonly declaringTypeParameterNames?: readonly string[];
  /** Emitted C# identifiers for the current declaring type's type parameters. */
  readonly declaringTypeParameterNameMap?: ReadonlyMap<string, string>;
  /** Whether the current class has a superclass (for virtual/override) */
  readonly hasSuperClass?: boolean;
  /** Whether the module has any inheritance (to decide virtual methods) */
  readonly hasInheritance?: boolean;
  /** Registry mapping TypeScript emit names to type bindings */
  readonly bindingsRegistry?: ReadonlyMap<string, FrontendTypeBinding>;
  /** Full frontend binding registry for exact source/global/module binding lookups during emission. */
  readonly bindingRegistry?: FrontendBindingRegistry;
  /** Map of local names to import binding info (for qualifying imported identifiers) */
  readonly importBindings?: ReadonlyMap<string, ImportBinding>;
  /** Set of variable names known to be int (from canonical for-loop counters) */
  readonly intLoopVars?: ReadonlySet<string>;
  /** Type parameter names in current scope (for detecting generic type contexts) */
  readonly typeParameters?: ReadonlySet<string>;
  /** Type parameter constraint kinds in current scope (for nullable emission decisions) */
  readonly typeParamConstraints?: ReadonlyMap<
    string,
    "class" | "struct" | "numeric" | "unconstrained"
  >;
  /**
   * When true, storage normalization may erase nullable unconstrained type
   * parameters to `object?` for storage declarations that cannot faithfully
   * represent `T | null` in C#.
   */
  readonly eraseNullableUnconstrainedTypeParameterStorage?: boolean;
  /**
   * Map from source type-parameter names to their emitted C# identifiers.
   *
   * Used to deterministically avoid C# identifier collisions between type parameters
   * and members after escaping/sanitization.
   */
  readonly typeParameterNameMap?: ReadonlyMap<string, string>;
  /** Return type of current function/method (for contextual typing in return statements) */
  readonly returnType?: IrType;
  /** Generator exchange local name (used by yield lowering). */
  readonly generatorExchangeVar?: string;
  /** Generator return-value capture local name (used by generatorReturnStatement lowering). */
  readonly generatorReturnValueVar?: string;
  /** Map of local type names to their definitions (for property type lookup) */
  readonly localTypes?: ReadonlyMap<string, LocalTypeInfo>;
  /**
   * Local type declarations that must be emitted as public because they appear
   * in an exported API signature in this module.
   */
  readonly publicLocalTypes?: ReadonlySet<string>;
  /** Current module namespace (used for fully qualifying local types when required) */
  readonly moduleNamespace?: string;
  /** Name of the module's static container class, when one is emitted */
  readonly moduleStaticClassName?: string;
  /** When true, fully qualify local types with module namespace/container */
  readonly qualifyLocalTypes?: boolean;
  /**
   * When true, same-module nominal references may emit their explicit
   * `resolvedClrType` identity instead of the short local name.
   *
   * Used only in contexts that require canonical emitted member surfaces,
   * such as runtime-union carrier layout construction.
   */
  readonly preferResolvedLocalClrIdentity?: boolean;
  /** Map of module static members (functions/fields) by original TS name */
  readonly valueSymbols?: ReadonlyMap<string, ValueSymbolInfo>;
  /** Type aliases currently being expanded to prevent recursive alias blowups. */
  readonly resolvingTypeAliases?: ReadonlySet<string>;
  /**
   * Active IR type emission stack keyed by stable type identity.
   *
   * Recursive structural graphs are legal after frontend lowering, but C#
   * type syntax cannot always represent them directly. The emitter uses this
   * stack to detect re-entry and fall back to `object` at the recursive edge
   * instead of recursing forever.
   */
  readonly activeTypeEmissionKeys?: ReadonlySet<string>;
  /** Active runtime-union layout construction stack keyed by carrier/type identity. */
  readonly activeRuntimeUnionLayoutKeys?: ReadonlySet<string>;
  /** Scoped identifier remaps for union narrowing */
  readonly narrowedBindings?: ReadonlyMap<string, NarrowedBinding>;
  /** Scoped remap for local variables/parameters to avoid C# shadowing errors */
  readonly localNameMap?: ReadonlyMap<string, string>;
  /**
   * Scoped map of local const boolean aliases to their authored condition expressions.
   *
   * Used to preserve deterministic narrowing through boolean alias conditions.
   */
  readonly conditionAliases?: ReadonlyMap<string, IrExpression>;
  /** Semantic (frontend IR) types for locals/parameters — alias names,
   *  union structure, and type-parameter shapes preserved exactly as authored.
   *  Used for narrowing analysis, guard analysis, and effective-type resolution.
   *  Populated alongside localValueTypes by registerLocalSymbolTypes. */
  readonly localSemanticTypes?: ReadonlyMap<string, SemanticType>;
  /** Scoped runtime storage types for locals/parameters when they differ from frontend IR narrowing. */
  readonly localValueTypes?: ReadonlyMap<string, StorageCarrier>;
  /** Module-level bindings that require mutable storage because JS array writes reassign them. */
  readonly mutableModuleBindings?: ReadonlySet<string>;
  /** Local class/interface property slots that require mutable storage because JS array writes reassign them. */
  readonly mutablePropertySlots?: ReadonlySet<string>;
  /** Bound object-literal receiver identifier for method-shorthand `this` lowering. */
  readonly objectLiteralThisIdentifier?: string;
  /**
   * Set of parameter names that are void-promise resolve callbacks.
   *
   * When `new Promise<void>((resolve) => { ... })` is emitted, `resolve` becomes a zero-arg
   * `Action`. TypeScript allows `resolve(undefined)` for void promises, but C# `Action` takes
   * zero arguments. This set tracks those names so the call emitter can strip the argument.
   */
  readonly voidResolveNames?: ReadonlySet<string>;
  /**
   * Promise resolve callback parameter names mapped to their normalized promised value type.
   *
   * TypeScript models Promise executors as `resolve: (value: T | PromiseLike<T>) => void`,
   * but emitted C# promise helpers always expose `Action<T>`. This map lets call emission
   * strip the PromiseLike union back to the promised value type when invoking those locals.
   */
  readonly promiseResolveValueTypes?: ReadonlyMap<string, IrType>;
  /**
   * Set of emitted C# local identifiers that have been used anywhere in the current method body.
   *
   * C# forbids reusing a local name in an outer scope after it has been declared in a nested scope
   * (CS0136), even when the nested-scope local is not visible at that later point.
   *
   * To preserve TypeScript lexical scoping while keeping generated C# valid, we reserve all local
   * identifiers globally within a method and deterministically rename later declarations as needed.
   */
  readonly usedLocalNames?: ReadonlySet<string>;
  /** Counter for generating unique temp variable names */
  readonly tempVarId?: number;
  /**
   * Required C# `using` directives for this module.
   *
   * Tsonic normally emits fully-qualified `global::` references and avoids `using` directives
   * to eliminate ambiguity. However, some features (notably C# extension-method invocation
   * syntax required by certain tooling, e.g. EF query precompilation) require namespace `using`
   * directives to be present.
   */
  readonly usings: Set<string>;
};

/**
 * Result of emitting C# code
 */
export type EmitResult = {
  /** The generated C# code */
  readonly code: string;
  /** Updated context after emission */
  readonly context: EmitterContext;
};

/**
 * Registry for collecting generated JSON support requirements.
 * This is a mutable structure shared across all modules during emission.
 */
export type JsonAotRegistry = {
  /** Stable-keyed set of C# types used at JsonSerializer call sites */
  readonly rootTypes: Map<string, CSharpTypeAst>;
  /** Whether any JsonSerializer calls were detected */
  needsJsonAot: boolean;
};
