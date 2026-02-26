/**
 * IR Soundness Gate - Validates IR before emission
 *
 * Walks the produced IR and asserts:
 * - No `anyType` anywhere (TSN7401 for explicit any, TSN7414 for unrepresentable)
 * - No unresolved/unsupported placeholders
 *
 * If this pass emits any errors, the emitter must not run.
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
  IrParameter,
  IrTypeParameter,
  IrInterfaceMember,
  IrPattern,
} from "../types.js";

/**
 * Result of soundness validation
 */
export type SoundnessValidationResult = {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
};

export type SoundnessGateOptions = {
  /**
   * Additional reference type names that are known to be resolvable by the emitter.
   *
   * This is primarily used for CLR types that can appear via inference/signatures
   * without being explicitly imported in the current module (e.g. tsbindgen arity
   * names like `Dictionary_2`).
   */
  readonly knownReferenceTypes?: ReadonlySet<string>;
};

/**
 * Known builtin types that are handled by emitter's built-in mappings
 * or are C# primitive type names that may appear in IR.
 * C# primitives correspond to types defined in @tsonic/core package.
 */
const KNOWN_BUILTINS = new Set([
  // JS/TS builtins handled by emitter
  "Array",
  "Promise",
  "Map",
  "Set",
  "Error",
  "Object",
  "Generator",
  "AsyncGenerator",
  "IteratorResult",
  // C# signed integers (from @tsonic/core)
  "sbyte",
  "short",
  "int",
  "long",
  "nint",
  "int128",
  // C# unsigned integers (from @tsonic/core)
  "byte",
  "ushort",
  "uint",
  "ulong",
  "nuint",
  "uint128",
  // C# floating-point (from @tsonic/core)
  "half",
  "float",
  "double",
  "decimal",
  // C# other primitives (from @tsonic/core)
  "bool",
  "char",
  // Additional C# keywords that are valid type names
  "string",
  "object",
  "void",
  // .NET types commonly used
  "IntPtr",
  "UIntPtr",
]);

/**
 * Context for tracking location during IR walk
 */
type ValidationContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
  /** Local type names defined in this module (class, interface, type alias, enum) */
  readonly localTypeNames: ReadonlySet<string>;
  /** Type names imported in this module */
  readonly importedTypeNames: ReadonlySet<string>;
  /** CLR/library type names known to be resolvable by the emitter */
  readonly knownReferenceTypes: ReadonlySet<string>;
  /** Type parameter names in current scope */
  readonly typeParameterNames: ReadonlySet<string>;
};

/**
 * Create a source location for a module
 */
const moduleLocation = (ctx: ValidationContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Check if a type contains anyType anywhere (recursively)
 */
const validateType = (
  type: IrType | undefined,
  ctx: ValidationContext,
  typeContext: string
): void => {
  if (!type) return;

  switch (type.kind) {
    case "anyType": {
      // TSN7414: Type cannot be represented in compiler subset
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7414",
          "error",
          `Type cannot be represented in compiler subset: ${typeContext}. The type resolved to 'any' which is not supported.`,
          moduleLocation(ctx),
          "Ensure the type can be explicitly annotated or is a recognized type alias."
        )
      );
      break;
    }

    case "arrayType":
      validateType(type.elementType, ctx, `${typeContext}[]`);
      break;

    case "tupleType":
      type.elementTypes.forEach((et, i) =>
        validateType(et, ctx, `${typeContext}[${i}]`)
      );
      break;

    case "functionType":
      type.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(type.returnType, ctx, `${typeContext} return type`);
      break;

    case "objectType":
      // TSN7421: objectType should have been lowered to a generated named type
      // If it reaches here, the anonymous type lowering pass missed it
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7421",
          "error",
          `Anonymous object type in ${typeContext} was not lowered to a named type. This is an internal compiler error.`,
          moduleLocation(ctx),
          "Please report this issue with a minimal reproduction."
        )
      );
      // Still validate members to catch any nested issues
      type.members.forEach((m) => validateInterfaceMember(m, ctx));
      break;

    case "dictionaryType":
      if (
        type.keyType.kind === "neverType" ||
        type.valueType.kind === "neverType"
      ) {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7419",
            "error",
            "'never' cannot be used as a generic type argument.",
            moduleLocation(ctx),
            "Rewrite the type to avoid never. For Result-like types, model explicit variants (Ok<T> | Err<E>) and have helpers return the specific variant type."
          )
        );
      }
      validateType(type.keyType, ctx, `${typeContext} key type`);
      validateType(type.valueType, ctx, `${typeContext} value type`);
      break;

    case "unionType":
      type.types.forEach((t, i) =>
        validateType(t, ctx, `${typeContext} union member ${i}`)
      );
      break;

    case "intersectionType":
      type.types.forEach((t, i) =>
        validateType(t, ctx, `${typeContext} intersection member ${i}`)
      );
      break;

    case "referenceType": {
      const { name, resolvedClrType, typeId } = type;

      // Note: ref<T>, out<T>, inref<T> are valid parameter passing modifiers.
      // They are handled by:
      // 1. Frontend: unwraps in function parameters (helpers.ts convertParameters)
      // 2. Emitter: detects `as out<T>` casts at call sites and emits `out` prefix
      // No validation error needed - these are legitimate types from @tsonic/core.

      // Check if this reference type is resolvable
      const isResolvable =
        // Has canonical identity (authoritative)
        typeId !== undefined ||
        // Has pre-resolved CLR type from IR
        resolvedClrType !== undefined ||
        // Is a known builtin handled by emitter
        KNOWN_BUILTINS.has(name) ||
        // Is a local type defined in this module
        ctx.localTypeNames.has(name) ||
        // Is an imported type
        ctx.importedTypeNames.has(name) ||
        // Is a known library type (e.g. from CLR bindings)
        ctx.knownReferenceTypes.has(name) ||
        // Is a type parameter in current scope
        ctx.typeParameterNames.has(name);

      if (!isResolvable) {
        // TSN7414: Unresolved reference type
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7414",
            "error",
            `Unresolved reference type '${name}' in ${typeContext}. The type is not local, not imported, and has no CLR binding.`,
            moduleLocation(ctx),
            "Ensure the type is imported or defined locally, or that CLR bindings are available."
          )
        );
      }

      // Validate type arguments recursively
      type.typeArguments?.forEach((ta, i) => {
        if (ta.kind === "neverType") {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7419",
              "error",
              "'never' cannot be used as a generic type argument.",
              moduleLocation(ctx),
              "Rewrite the type to avoid never. For Result-like types, model explicit variants (Ok<T> | Err<E>) and have helpers return the specific variant type."
            )
          );
        }
        validateType(ta, ctx, `${typeContext}<arg ${i}>`);
      });
      break;
    }

    // These types are valid and don't contain nested types
    case "primitiveType":
    case "typeParameterType":
    case "literalType":
    case "voidType":
    case "neverType":
      break;

    case "unknownType":
      // unknownType is a poison type indicating failed type recovery.
      // It's valid here because the specific diagnostic (TSN5201/TSN5203)
      // is emitted in validateExpression when checking inferredType.
      break;
  }
};

/**
 * Validate a parameter
 */
const validateParameter = (
  param: IrParameter,
  ctx: ValidationContext
): void => {
  const paramName =
    param.pattern.kind === "identifierPattern" ? param.pattern.name : "param";
  validateType(param.type, ctx, `parameter '${paramName}'`);
  validatePattern(param.pattern, ctx);
  if (param.initializer) {
    validateExpression(param.initializer, ctx);
  }
};

/**
 * Validate a type parameter
 */
const validateTypeParameter = (
  tp: IrTypeParameter,
  ctx: ValidationContext
): void => {
  validateType(tp.constraint, ctx, `type parameter '${tp.name}' constraint`);
  validateType(tp.default, ctx, `type parameter '${tp.name}' default`);
  tp.structuralMembers?.forEach((m) => validateInterfaceMember(m, ctx));
};

/**
 * Validate an interface member
 */
const validateInterfaceMember = (
  member: IrInterfaceMember,
  ctx: ValidationContext
): void => {
  switch (member.kind) {
    case "propertySignature":
      validateType(member.type, ctx, `property '${member.name}'`);
      break;
    case "methodSignature":
      member.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      member.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(
        member.returnType,
        ctx,
        `method '${member.name}' return type`
      );
      break;
  }
};

/**
 * Validate a pattern
 */
const validatePattern = (pattern: IrPattern, ctx: ValidationContext): void => {
  switch (pattern.kind) {
    case "identifierPattern":
      validateType(pattern.type, ctx, `pattern '${pattern.name}'`);
      break;
    case "arrayPattern":
      pattern.elements.forEach((e) => {
        if (e) {
          validatePattern(e.pattern, ctx);
          if (e.defaultExpr) {
            validateExpression(e.defaultExpr, ctx);
          }
        }
      });
      break;
    case "objectPattern":
      pattern.properties.forEach((p) => {
        if (p.kind === "property") {
          validatePattern(p.value, ctx);
          if (p.defaultExpr) {
            validateExpression(p.defaultExpr, ctx);
          }
        } else {
          validatePattern(p.pattern, ctx);
        }
      });
      break;
  }
};

/**
 * Validate an expression (and its nested types/expressions)
 *
 * NOTE: We intentionally do NOT validate the `inferredType` field on expressions.
 * `inferredType` is informational and optional - if the type checker couldn't
 * determine a specific type, it may be `anyType`, but this doesn't indicate
 * a user error or an unsupported type. The emitter works correctly regardless.
 *
 * We DO validate:
 * - Explicit type annotations (parameters, return types, variable types)
 * - Type arguments on calls and new expressions
 * - Contextual types on object literals (which affect C# type synthesis)
 */
const validateExpression = (
  expr: IrExpression,
  ctx: ValidationContext
): void => {
  switch (expr.kind) {
    case "literal":
    case "identifier":
    case "this":
      break;

    case "array":
      expr.elements.forEach((e) => {
        if (e) validateExpression(e, ctx);
      });
      break;

    case "object":
      if (expr.contextualType) {
        validateType(
          expr.contextualType,
          ctx,
          "object literal contextual type"
        );
      }
      expr.properties.forEach((p) => {
        if (p.kind === "property") {
          if (typeof p.key !== "string") {
            validateExpression(p.key, ctx);
          }
          validateExpression(p.value, ctx);
        } else {
          validateExpression(p.expression, ctx);
        }
      });
      break;

    case "functionExpression":
      expr.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(expr.returnType, ctx, "function expression return type");
      validateStatement(expr.body, ctx);
      break;

    case "arrowFunction":
      expr.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(expr.returnType, ctx, "arrow function return type");
      if (expr.body.kind === "blockStatement") {
        validateStatement(expr.body, ctx);
      } else {
        validateExpression(expr.body, ctx);
      }
      break;

    case "memberAccess": {
      validateExpression(expr.object, ctx);
      if (typeof expr.property !== "string") {
        validateExpression(expr.property, ctx);
      }
      // DETERMINISTIC TYPING: Validate that member type was recovered
      // Note: inferredType may be undefined if memberBinding exists (valid - emitter uses binding)
      // Only flag unknownType which indicates a failed type recovery attempt
      const allowComputedDictionaryUnknown =
        expr.isComputed && expr.accessKind === "dictionary";
      if (
        expr.inferredType?.kind === "unknownType" &&
        !allowComputedDictionaryUnknown
      ) {
        const propName =
          typeof expr.property === "string" ? expr.property : "<computed>";
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN5203",
            "error",
            `Member/property type for '${propName}' cannot be recovered deterministically. Add an explicit type annotation at the declaration site.`,
            expr.sourceSpan ?? moduleLocation(ctx),
            "Ensure the property has a declared type annotation in its interface/class definition."
          )
        );
      }
      break;
    }

    case "call":
      // istype<T>(x) is a compiler-only marker used for overload specialization.
      // It must never reach emission; overload-group conversion erases it.
      if (expr.callee.kind === "identifier" && expr.callee.name === "istype") {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7441",
            "error",
            "istype<T>(...) is a compile-time-only marker and must be erased during overload specialization.",
            expr.sourceSpan ?? moduleLocation(ctx),
            "Use istype<T>(pN) only inside overload implementations that are being specialized, or remove it."
          )
        );
      }
      // Core language intrinsics must never reach emission as normal calls.
      //
      // Airplane-grade rule:
      // - If these appear as IrCallExpression, it means an intrinsic was not lowered
      //   into its dedicated IR kind (or a not-yet-supported intrinsic was used).
      if (expr.callee.kind === "identifier") {
        const name = expr.callee.name;

        // Intrinsics that MUST lower to dedicated IR nodes.
        if (
          name === "asinterface" ||
          name === "trycast" ||
          name === "stackalloc" ||
          name === "defaultof" ||
          name === "out" ||
          name === "ref" ||
          name === "inref"
        ) {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7442",
              "error",
              `'${name}(...)' is a compiler intrinsic and cannot be emitted as a normal call.`,
              expr.sourceSpan ?? moduleLocation(ctx),
              `Ensure '${name}' is imported from "@tsonic/core/lang.js" and called with the correct signature.\n` +
                `If this call is correct and this error persists, please report it with a minimal repro.`
            )
          );
        }

        // Reserved intrinsics (declared in @tsonic/core/lang.js) that are not implemented yet.
        if (name === "nameof" || name === "sizeof") {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7443",
              "error",
              `'${name}<...>(...)' is reserved but not implemented yet.`,
              expr.sourceSpan ?? moduleLocation(ctx),
              `Remove this call for now. (${name} will be added as a compile-time intrinsic in a future release.)`
            )
          );
        }
      }
      validateExpression(expr.callee, ctx);
      expr.arguments.forEach((a) => validateExpression(a, ctx));
      expr.typeArguments?.forEach((ta, i) =>
        validateType(ta, ctx, `call type argument ${i}`)
      );
      if (expr.narrowing) {
        validateType(expr.narrowing.targetType, ctx, "type predicate target");
      }
      // DETERMINISTIC TYPING: Validate that return type was recovered
      if (expr.inferredType?.kind === "unknownType") {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN5201",
            "error",
            `Return type of this call cannot be recovered deterministically. Add an explicit return type annotation at the function/method declaration.`,
            expr.sourceSpan ?? moduleLocation(ctx),
            "Ensure the called function/method has a declared return type annotation."
          )
        );
      }
      break;

    case "new":
      validateExpression(expr.callee, ctx);
      expr.arguments.forEach((a) => validateExpression(a, ctx));
      expr.typeArguments?.forEach((ta, i) =>
        validateType(ta, ctx, `new type argument ${i}`)
      );
      // DETERMINISTIC TYPING: Validate that constructed type was recovered
      if (expr.inferredType?.kind === "unknownType") {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN5202",
            "error",
            `Type arguments for this constructor call cannot be inferred deterministically. Add explicit type arguments: new Foo<T>(...).`,
            expr.sourceSpan ?? moduleLocation(ctx),
            "Provide explicit type arguments when instantiating generic types."
          )
        );
      }
      break;

    case "update":
    case "unary":
    case "await":
      validateExpression(expr.expression, ctx);
      break;

    case "yield":
      if (expr.expression) {
        validateExpression(expr.expression, ctx);
      }
      break;

    case "binary":
    case "logical":
      validateExpression(expr.left, ctx);
      validateExpression(expr.right, ctx);
      break;

    case "conditional":
      validateExpression(expr.condition, ctx);
      validateExpression(expr.whenTrue, ctx);
      validateExpression(expr.whenFalse, ctx);
      break;

    case "assignment":
      if (
        expr.left.kind === "identifierPattern" ||
        expr.left.kind === "arrayPattern" ||
        expr.left.kind === "objectPattern"
      ) {
        validatePattern(expr.left, ctx);
      } else {
        validateExpression(expr.left, ctx);
      }
      validateExpression(expr.right, ctx);
      break;

    case "templateLiteral":
      expr.expressions.forEach((e) => validateExpression(e, ctx));
      break;

    case "spread":
      validateExpression(expr.expression, ctx);
      break;
  }
};

/**
 * Validate a statement (and its nested types/expressions/statements)
 */
const validateStatement = (stmt: IrStatement, ctx: ValidationContext): void => {
  switch (stmt.kind) {
    case "variableDeclaration":
      stmt.declarations.forEach((d) => {
        validatePattern(d.name, ctx);
        validateType(d.type, ctx, "variable declaration type");
        if (d.initializer) {
          validateExpression(d.initializer, ctx);
        }
      });
      break;

    case "functionDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      stmt.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(stmt.returnType, ctx, `function '${stmt.name}' return type`);
      validateStatement(stmt.body, ctx);
      break;

    case "classDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      if (stmt.superClass) {
        validateType(stmt.superClass, ctx, `class '${stmt.name}' extends`);
      }
      stmt.implements.forEach((i, idx) =>
        validateType(i, ctx, `class '${stmt.name}' implements ${idx}`)
      );
      stmt.members.forEach((m) => {
        switch (m.kind) {
          case "methodDeclaration":
            m.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
            m.parameters.forEach((p) => validateParameter(p, ctx));
            validateType(m.returnType, ctx, `method '${m.name}' return type`);
            if (m.body) {
              validateStatement(m.body, ctx);
            }
            break;
          case "propertyDeclaration":
            validateType(m.type, ctx, `property '${m.name}'`);
            if (m.initializer) {
              validateExpression(m.initializer, ctx);
            }
            break;
          case "constructorDeclaration":
            m.parameters.forEach((p) => validateParameter(p, ctx));
            if (m.body) {
              validateStatement(m.body, ctx);
            }
            break;
        }
      });
      break;

    case "interfaceDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      stmt.extends.forEach((e, idx) =>
        validateType(e, ctx, `interface '${stmt.name}' extends ${idx}`)
      );
      stmt.members.forEach((m) => validateInterfaceMember(m, ctx));
      break;

    case "enumDeclaration":
      stmt.members.forEach((m) => {
        if (m.initializer) {
          validateExpression(m.initializer, ctx);
        }
      });
      break;

    case "typeAliasDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      // Special case: objectType as the direct RHS of a type alias is valid
      // The emitter generates a TypeName__Alias class for these
      if (stmt.type.kind === "objectType") {
        // Validate nested types within the objectType members
        stmt.type.members.forEach((m) => validateInterfaceMember(m, ctx));
      } else {
        validateType(stmt.type, ctx, `type alias '${stmt.name}'`);
      }
      break;

    case "expressionStatement":
      validateExpression(stmt.expression, ctx);
      break;

    case "returnStatement":
      if (stmt.expression) {
        validateExpression(stmt.expression, ctx);
      }
      break;

    case "ifStatement":
      validateExpression(stmt.condition, ctx);
      validateStatement(stmt.thenStatement, ctx);
      if (stmt.elseStatement) {
        validateStatement(stmt.elseStatement, ctx);
      }
      break;

    case "whileStatement":
      validateExpression(stmt.condition, ctx);
      validateStatement(stmt.body, ctx);
      break;

    case "forStatement":
      if (stmt.initializer) {
        if (stmt.initializer.kind === "variableDeclaration") {
          validateStatement(stmt.initializer, ctx);
        } else {
          validateExpression(stmt.initializer, ctx);
        }
      }
      if (stmt.condition) {
        validateExpression(stmt.condition, ctx);
      }
      if (stmt.update) {
        validateExpression(stmt.update, ctx);
      }
      validateStatement(stmt.body, ctx);
      break;

    case "forOfStatement":
      validatePattern(stmt.variable, ctx);
      validateExpression(stmt.expression, ctx);
      validateStatement(stmt.body, ctx);
      break;

    case "switchStatement":
      validateExpression(stmt.expression, ctx);
      stmt.cases.forEach((c) => {
        if (c.test) {
          validateExpression(c.test, ctx);
        }
        c.statements.forEach((s) => validateStatement(s, ctx));
      });
      break;

    case "throwStatement":
      validateExpression(stmt.expression, ctx);
      break;

    case "tryStatement":
      validateStatement(stmt.tryBlock, ctx);
      if (stmt.catchClause) {
        if (stmt.catchClause.parameter) {
          validatePattern(stmt.catchClause.parameter, ctx);
        }
        validateStatement(stmt.catchClause.body, ctx);
      }
      if (stmt.finallyBlock) {
        validateStatement(stmt.finallyBlock, ctx);
      }
      break;

    case "blockStatement":
      stmt.statements.forEach((s) => validateStatement(s, ctx));
      break;

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      break;

    case "yieldStatement":
      if (stmt.output) {
        validateExpression(stmt.output, ctx);
      }
      if (stmt.receiveTarget) {
        validatePattern(stmt.receiveTarget, ctx);
      }
      if (stmt.receivedType) {
        validateType(stmt.receivedType, ctx, "yield received type");
      }
      break;

    case "generatorReturnStatement":
      if (stmt.expression) {
        validateExpression(stmt.expression, ctx);
      }
      break;
  }
};

/**
 * Extract local type names from module statements
 */
const extractLocalTypeNames = (
  statements: readonly IrStatement[]
): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const stmt of statements) {
    switch (stmt.kind) {
      case "classDeclaration":
      case "interfaceDeclaration":
      case "typeAliasDeclaration":
      case "enumDeclaration":
        names.add(stmt.name);
        break;
    }
  }

  return names;
};

/**
 * Extract imported type names from module imports
 */
const extractImportedTypeNames = (module: IrModule): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const imp of module.imports) {
    for (const spec of imp.specifiers) {
      // Include all imports - the emitter will resolve whether they're types or values
      // Named imports use localName (the name in this module's scope)
      if (spec.kind === "named" || spec.kind === "default") {
        names.add(spec.localName);
      }
      // Namespace imports (import * as NS) - the namespace itself is available
      if (spec.kind === "namespace") {
        names.add(spec.localName);
      }
    }
  }

  return names;
};

/**
 * Validate a single module
 */
const validateModule = (
  module: IrModule,
  knownReferenceTypes: ReadonlySet<string>
): readonly Diagnostic[] => {
  // Extract local and imported type names for reference type validation
  const localTypeNames = extractLocalTypeNames(module.body);
  const importedTypeNames = extractImportedTypeNames(module);

  const ctx: ValidationContext = {
    filePath: module.filePath,
    diagnostics: [],
    localTypeNames,
    importedTypeNames,
    knownReferenceTypes,
    typeParameterNames: new Set(), // Will be populated per-scope during validation
  };

  // Validate all statements in the module body
  module.body.forEach((stmt) => validateStatement(stmt, ctx));

  // Validate exports
  module.exports.forEach((exp) => {
    if (exp.kind === "default") {
      validateExpression(exp.expression, ctx);
    } else if (exp.kind === "declaration") {
      validateStatement(exp.declaration, ctx);
    }
  });

  return ctx.diagnostics;
};

/**
 * Run soundness validation on all modules
 *
 * This is the IR soundness gate - if any diagnostics are returned,
 * the emitter must not run.
 */
export const validateIrSoundness = (
  modules: readonly IrModule[],
  options: SoundnessGateOptions = {}
): SoundnessValidationResult => {
  const allDiagnostics: Diagnostic[] = [];
  const knownReferenceTypes = options.knownReferenceTypes ?? new Set<string>();

  for (const module of modules) {
    const moduleDiagnostics = validateModule(module, knownReferenceTypes);
    allDiagnostics.push(...moduleDiagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    diagnostics: allDiagnostics,
  };
};
