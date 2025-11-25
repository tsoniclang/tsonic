/**
 * Supporting types (patterns, parameters, operators, accessibility, etc.)
 */

import { IrType } from "./ir-types.js";
import { IrExpression } from "./expressions.js";

// ============================================================================
// Patterns (for destructuring)
// ============================================================================

export type IrPattern = IrIdentifierPattern | IrArrayPattern | IrObjectPattern;

export type IrIdentifierPattern = {
  readonly kind: "identifierPattern";
  readonly name: string;
  readonly type?: IrType;
};

export type IrArrayPattern = {
  readonly kind: "arrayPattern";
  readonly elements: readonly (IrPattern | undefined)[]; // undefined for holes
};

export type IrObjectPattern = {
  readonly kind: "objectPattern";
  readonly properties: readonly IrObjectPatternProperty[];
};

export type IrObjectPatternProperty =
  | {
      readonly kind: "property";
      readonly key: string;
      readonly value: IrPattern;
      readonly shorthand: boolean;
    }
  | { readonly kind: "rest"; readonly pattern: IrPattern };

// ============================================================================
// Type Parameters
// ============================================================================

export type IrTypeParameter = {
  readonly kind: "typeParameter";
  readonly name: string;
  readonly constraint?: IrType; // Can reference other type parameters (enables recursion)
  readonly default?: IrType;
  readonly variance?: "in" | "out"; // For covariance/contravariance
  readonly isStructuralConstraint?: boolean; // Flag for { id: number } style constraints
  readonly structuralMembers?: readonly IrInterfaceMember[]; // Properties for structural constraints
};

// ============================================================================
// Parameters
// ============================================================================

export type IrParameter = {
  readonly kind: "parameter";
  readonly pattern: IrPattern;
  readonly type?: IrType;
  readonly initializer?: IrExpression;
  readonly isOptional: boolean;
  readonly isRest: boolean;
  readonly passing: "value" | "ref" | "out" | "in"; // C# parameter passing mode
};

// ============================================================================
// Interface Members (used by interfaces and object types)
// ============================================================================

export type IrInterfaceMember = IrPropertySignature | IrMethodSignature;

export type IrPropertySignature = {
  readonly kind: "propertySignature";
  readonly name: string;
  readonly type: IrType;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
};

export type IrMethodSignature = {
  readonly kind: "methodSignature";
  readonly name: string;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
};

// ============================================================================
// Accessibility and Operators
// ============================================================================

export type IrAccessibility = "public" | "private" | "protected";

export type IrBinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**"
  | "=="
  | "!="
  | "==="
  | "!=="
  | "<"
  | ">"
  | "<="
  | ">="
  | "<<"
  | ">>"
  | ">>>"
  | "&"
  | "|"
  | "^"
  | "in"
  | "instanceof";

export type IrAssignmentOperator =
  | "="
  | "+="
  | "-="
  | "*="
  | "/="
  | "%="
  | "**="
  | "<<="
  | ">>="
  | ">>>="
  | "&="
  | "|="
  | "^="
  | "&&="
  | "||="
  | "??=";
