/**
 * Supporting types (patterns, parameters, operators, accessibility, etc.)
 */

import { IrType, IrAttribute } from "./ir-types.js";
import type { IrExpression } from "./expressions.js";

// ============================================================================
// Patterns (for destructuring)
// ============================================================================

export type IrPattern = IrIdentifierPattern | IrArrayPattern | IrObjectPattern;

export type IrIdentifierPattern = {
  readonly kind: "identifierPattern";
  readonly name: string;
  readonly type?: IrType;
};

/**
 * Element in an array destructuring pattern.
 * Can contain a pattern, optional default expression, and rest marker.
 */
export type IrArrayPatternElement = {
  readonly pattern: IrPattern;
  /** Default value expression if element is missing/undefined */
  readonly defaultExpr?: IrExpression;
  /** True if this is a rest element: [...rest] */
  readonly isRest?: boolean;
};

export type IrArrayPattern = {
  readonly kind: "arrayPattern";
  /** Elements in the pattern. undefined represents holes (elisions). */
  readonly elements: readonly (IrArrayPatternElement | undefined)[];
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
      /** Default value expression if property is missing/undefined */
      readonly defaultExpr?: IrExpression;
    }
  | {
      readonly kind: "rest";
      readonly pattern: IrPattern;
      /** Computed remaining members from RHS type (for rest type synthesis) */
      readonly restShapeMembers?: readonly IrInterfaceMember[];
      /** Name of synthesized type for rest object */
      readonly restSynthTypeName?: string;
    };

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
  /** True when this parameter is the extension-method receiver (`this` parameter in C#). */
  readonly isExtensionReceiver?: boolean;
  /** C# attributes to emit before the parameter */
  readonly attributes?: readonly IrAttribute[];
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

export type IrAccessibility =
  | "public"
  | "private"
  | "protected"
  | "internal"
  | "protected internal";

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
