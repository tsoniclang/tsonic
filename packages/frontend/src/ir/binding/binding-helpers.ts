/**
 * Binding Layer — Pure Helper Functions
 *
 * Module-level helper functions used by the binding factory.
 * These exist outside the createBinding() closure and are pure functions
 * that operate on TypeScript AST nodes.
 */

import ts from "typescript";
import type {
  DeclKind,
  ParameterNode,
  TypeParameterNode,
  SignatureTypePredicate,
  ClassMemberNames,
} from "../type-system/internal/handle-types.js";
import type { ParameterMode } from "../type-system/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const getTypeNodeFromDeclaration = (
  decl: ts.Declaration
): ts.TypeNode | undefined => {
  if (ts.isVariableDeclaration(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) {
    return decl.type;
  }
  if (ts.isParameter(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isPropertyDeclaration(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isPropertySignature(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isTypeAliasDeclaration(decl)) {
    return decl.type;
  }
  return undefined;
};

export const getMemberTypeAnnotation = (
  decl: ts.Declaration
): ts.TypeNode | undefined => {
  if (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl)) {
    return decl.type;
  }
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
    // For methods, we could return a function type node if needed
    return decl.type;
  }
  if (ts.isGetAccessorDeclaration(decl)) {
    return decl.type;
  }
  if (ts.isSetAccessorDeclaration(decl)) {
    // Setter declarations have no return type; use the value parameter type.
    const valueParam = decl.parameters[0];
    return valueParam?.type;
  }
  return undefined;
};

export const getDeclKind = (decl: ts.Declaration): DeclKind => {
  if (ts.isVariableDeclaration(decl)) return "variable";
  if (ts.isFunctionDeclaration(decl)) return "function";
  if (ts.isClassDeclaration(decl)) return "class";
  if (ts.isInterfaceDeclaration(decl)) return "interface";
  if (ts.isTypeAliasDeclaration(decl)) return "typeAlias";
  if (ts.isEnumDeclaration(decl)) return "enum";
  if (ts.isParameter(decl)) return "parameter";
  if (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl))
    return "property";
  if (ts.isGetAccessorDeclaration(decl) || ts.isSetAccessorDeclaration(decl))
    return "property";
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl))
    return "method";
  return "variable";
};

export const getReturnTypeNode = (
  decl: ts.SignatureDeclaration | undefined
): ts.TypeNode | undefined => {
  if (!decl) return undefined;
  return decl.type;
};

export const isThisParameter = (p: ts.ParameterDeclaration): boolean => {
  return ts.isIdentifier(p.name) && p.name.text === "this";
};

export const extractThisParameterTypeNode = (
  decl: ts.SignatureDeclaration | undefined
): ts.TypeNode | undefined => {
  if (!decl) return undefined;

  const thisParam = decl.parameters.find(isThisParameter);
  if (!thisParam) return undefined;

  const normalized = normalizeParameterTypeNode(thisParam.type);
  return normalized.typeNode;
};

/**
 * Extract and normalize parameter nodes from a signature declaration.
 *
 * ALICE'S SPEC: Parameter mode detection happens HERE during signature registration.
 * If the parameter type is `ref<T>`, `out<T>`, or `in<T>`:
 * - Set `mode` to that keyword
 * - Set `typeNode` to the INNER T node (unwrapped)
 *
 * This is PURE SYNTAX inspection, no TS type inference.
 */
export const extractParameterNodes = (
  decl: ts.SignatureDeclaration | undefined
): readonly ParameterNode[] => {
  if (!decl) return [];
  // TypeScript `this:` parameters are not call arguments. Exclude them from arity,
  // but keep the typeNode available via extractThisParameterTypeNode().
  const params = decl.parameters.filter((p) => !isThisParameter(p));

  return params.map((p) => {
    const normalized = normalizeParameterTypeNode(p.type);
    return {
      name: ts.isIdentifier(p.name) ? p.name.text : "param",
      typeNode: normalized.typeNode,
      isOptional: !!p.questionToken || !!p.initializer,
      isRest: !!p.dotDotDotToken,
      mode: normalized.mode,
    };
  });
};

/**
 * Normalize a parameter type node by detecting ref<T>/out<T>/in<T> wrappers.
 *
 * This is PURE SYNTAX analysis - we look at the TypeNode AST structure:
 * - If it's a TypeReferenceNode with identifier name "ref"/"out"/"in"
 * - And exactly one type argument
 * - Then unwrap to get the inner type
 *
 * @param typeNode The parameter's type node
 * @returns { mode, typeNode } where typeNode is unwrapped if wrapper detected
 */
export const normalizeParameterTypeNode = (
  typeNode: ts.TypeNode | undefined
): { mode: ParameterMode; typeNode: ts.TypeNode | undefined } => {
  if (!typeNode) {
    return { mode: "value", typeNode: undefined };
  }

  // Mirror IR conversion rules: wrappers may be nested and may appear in any order.
  // - thisarg<T> marks an extension-method receiver parameter (erases for typing)
  // - ref<T>/out<T>/in<T>/inref<T> set passing mode and erase to T for typing
  let mode: ParameterMode = "value";
  let current: ts.TypeNode | undefined = typeNode;

  while (current) {
    if (ts.isParenthesizedTypeNode(current)) {
      current = current.type;
      continue;
    }

    if (!ts.isTypeReferenceNode(current)) break;
    if (!ts.isIdentifier(current.typeName)) break;
    if (!current.typeArguments || current.typeArguments.length !== 1) break;
    const inner: ts.TypeNode | undefined = current.typeArguments[0];
    if (!inner) break;

    const wrapperName = current.typeName.text;
    if (wrapperName === "thisarg") {
      current = inner;
      continue;
    }

    if (wrapperName === "ref" || wrapperName === "out") {
      mode = wrapperName;
      current = inner;
      continue;
    }

    if (wrapperName === "in" || wrapperName === "inref") {
      mode = "in";
      current = inner;
      continue;
    }

    break;
  }

  // No wrapper detected - regular parameter
  return { mode, typeNode: current ?? typeNode };
};

export const convertTypeParameterDeclarations = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
): readonly TypeParameterNode[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) return undefined;
  return typeParameters.map((tp) => ({
    name: tp.name.text,
    constraintNode: tp.constraint,
    defaultNode: tp.default,
  }));
};

export const extractTypeParameterNodes = (
  decl: ts.SignatureDeclaration | undefined
): readonly TypeParameterNode[] | undefined => {
  if (!decl) return undefined;

  // Constructor declarations don't have their own type parameters in TS syntax,
  // but the enclosing class may be generic (class Box<T> { constructor(x: T) {} }).
  // For constructor signature typing/inference, the relevant type parameters are the
  // class type parameters.
  if (ts.isConstructorDeclaration(decl)) {
    const parent = decl.parent;
    if (ts.isClassDeclaration(parent)) {
      return convertTypeParameterDeclarations(parent.typeParameters);
    }
    return undefined;
  }

  return convertTypeParameterDeclarations(decl.typeParameters);
};

/**
 * Extract type predicate from a signature's return type.
 *
 * ALICE'S SPEC: This is PURE SYNTAX inspection at registration time.
 * We check if the return TypeNode is a TypePredicateNode (x is T or this is T).
 * No TS type inference is used.
 *
 * @param returnTypeNode The signature's return type node
 * @param decl The signature declaration (to find parameter index)
 * @returns SignatureTypePredicate or undefined if not a predicate
 */
export const extractTypePredicate = (
  returnTypeNode: ts.TypeNode | undefined,
  decl: ts.SignatureDeclaration | undefined
): SignatureTypePredicate | undefined => {
  // Return type must be a TypePredicateNode
  if (!returnTypeNode || !ts.isTypePredicateNode(returnTypeNode)) {
    return undefined;
  }

  const predNode = returnTypeNode;

  // Must have a target type
  if (!predNode.type) {
    return undefined;
  }

  // Check if it's "this is T" predicate
  if (predNode.parameterName.kind === ts.SyntaxKind.ThisType) {
    return {
      kind: "this",
      targetTypeNode: predNode.type,
    };
  }

  // Check if it's "param is T" predicate
  if (ts.isIdentifier(predNode.parameterName)) {
    const paramName = predNode.parameterName.text;

    // Find parameter index
    const paramIndex =
      decl?.parameters.findIndex(
        (p) => ts.isIdentifier(p.name) && p.name.text === paramName
      ) ?? -1;

    if (paramIndex >= 0) {
      return {
        kind: "param",
        parameterName: paramName,
        parameterIndex: paramIndex,
        targetTypeNode: predNode.type,
      };
    }
  }

  return undefined;
};

export const isOptionalMember = (symbol: ts.Symbol): boolean => {
  return (symbol.flags & ts.SymbolFlags.Optional) !== 0;
};

export const isReadonlyMember = (decl: ts.Declaration | undefined): boolean => {
  if (!decl) return false;
  if (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl)) {
    return (
      decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ??
      false
    );
  }
  return false;
};

/**
 * Extract declaring identity from a signature declaration.
 *
 * CRITICAL for Alice's spec: Without this, resolveCall() cannot compute
 * inheritance substitution. It would have to "guess" the method name
 * from the signature, which breaks on overloads, aliases, etc.
 *
 * DESIGN (Phase 5 Step 4): Store the declaring type as a **simple TS name**
 * (identifier text like "Box"), NOT a TS "fully qualified name". TypeSystem
 * uses UnifiedTypeCatalog.resolveTsName() to resolve this to the proper
 * CLR FQ name for inheritance substitution.
 *
 * @param decl The signature declaration (method, function, etc.)
 * @returns { typeTsName, memberName } or undefined if not a member
 */
export const extractDeclaringIdentity = (
  decl: ts.SignatureDeclaration | undefined
): { typeTsName: string; memberName: string } | undefined => {
  if (!decl) return undefined;

  const normalizeTsbindgenTypeName = (name: string): string => {
    if (name.endsWith("$instance")) {
      return name.slice(0, -"$instance".length);
    }
    if (name.startsWith("__") && name.endsWith("$views")) {
      return name.slice(2, -"$views".length);
    }
    return name;
  };

  // Check if this is a method (class or interface member)
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
    const parent = decl.parent;

    // Get the method name
    const memberName = ts.isIdentifier(decl.name)
      ? decl.name.text
      : (decl.name?.getText() ?? "unknown");

    // Get the containing type's simple name (identifier text)
    if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
      if (parent.name) {
        // Use the simple identifier text, not checker.getFullyQualifiedName
        const typeTsName = normalizeTsbindgenTypeName(parent.name.text);
        return { typeTsName, memberName };
      }
    }

    // tsbindgen static containers are commonly emitted as:
    //   export const Foo: { bar(...): ... }
    //
    // In this case, method signatures live under a TypeLiteralNode whose parent is
    // the variable declaration for `Foo`. We still need declaring identity so
    // TypeSystem can apply airplane-grade overload correction using CLR metadata.
    if (ts.isTypeLiteralNode(parent)) {
      const container = parent.parent;
      if (
        ts.isVariableDeclaration(container) &&
        ts.isIdentifier(container.name)
      ) {
        const typeTsName = normalizeTsbindgenTypeName(container.name.text);
        return { typeTsName, memberName };
      }
    }

    // Object literal method - use parent context
    if (ts.isObjectLiteralExpression(parent)) {
      // For object literals, we don't have a named type
      return undefined;
    }
  }

  // Constructor declarations
  if (ts.isConstructorDeclaration(decl)) {
    const parent = decl.parent;
    if (ts.isClassDeclaration(parent) && parent.name) {
      // Use the simple identifier text
      const typeTsName = normalizeTsbindgenTypeName(parent.name.text);
      return { typeTsName, memberName: "constructor" };
    }
  }

  // Getter/setter declarations
  if (ts.isGetAccessorDeclaration(decl) || ts.isSetAccessorDeclaration(decl)) {
    const parent = decl.parent;
    const memberName = ts.isIdentifier(decl.name)
      ? decl.name.text
      : (decl.name?.getText() ?? "unknown");

    if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
      if (parent.name) {
        // Use the simple identifier text
        const typeTsName = normalizeTsbindgenTypeName(parent.name.text);
        return { typeTsName, memberName };
      }
    }
  }

  // Standalone functions don't have a declaring type
  return undefined;
};

/**
 * Extract class member names from a ClassDeclaration.
 *
 * ALICE'S SPEC: This is PURE SYNTAX inspection at registration time.
 * We iterate class members and collect method/property names.
 * This data is used by TypeSystem.checkTsClassMemberOverride without
 * needing to inspect TS AST nodes or use hardcoded SyntaxKind numbers.
 *
 * @param classDecl The class declaration node
 * @returns ClassMemberNames with method and property name sets
 */
export const extractClassMemberNames = (
  classDecl: ts.ClassDeclaration
): ClassMemberNames => {
  const methods = new Set<string>();
  const properties = new Set<string>();

  for (const member of classDecl.members) {
    // Get member name if it has an identifier
    const name = ts.isMethodDeclaration(member)
      ? ts.isIdentifier(member.name)
        ? member.name.text
        : undefined
      : ts.isPropertyDeclaration(member)
        ? ts.isIdentifier(member.name)
          ? member.name.text
          : undefined
        : ts.isGetAccessorDeclaration(member) ||
            ts.isSetAccessorDeclaration(member)
          ? ts.isIdentifier(member.name)
            ? member.name.text
            : undefined
          : undefined;

    if (!name) continue;

    if (ts.isMethodDeclaration(member)) {
      methods.add(name);
    } else if (ts.isPropertyDeclaration(member)) {
      properties.add(name);
    } else if (
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member)
    ) {
      // Accessors are treated as properties for override detection
      properties.add(name);
    }
  }

  return { methods, properties };
};
