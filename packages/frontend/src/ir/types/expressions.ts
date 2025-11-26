/**
 * Expression types for IR
 */

import { IrType } from "./ir-types.js";
import {
  IrParameter,
  IrPattern,
  IrBinaryOperator,
  IrAssignmentOperator,
} from "./helpers.js";
import { IrBlockStatement } from "./statements.js";

export type IrExpression =
  | IrLiteralExpression
  | IrIdentifierExpression
  | IrArrayExpression
  | IrObjectExpression
  | IrFunctionExpression
  | IrArrowFunctionExpression
  | IrMemberExpression
  | IrCallExpression
  | IrNewExpression
  | IrThisExpression
  | IrUpdateExpression
  | IrUnaryExpression
  | IrBinaryExpression
  | IrLogicalExpression
  | IrConditionalExpression
  | IrAssignmentExpression
  | IrTemplateLiteralExpression
  | IrSpreadExpression
  | IrAwaitExpression
  | IrYieldExpression;

export type IrLiteralExpression = {
  readonly kind: "literal";
  readonly value: string | number | boolean | null | undefined;
  readonly raw?: string;
  readonly inferredType?: IrType;
};

export type IrIdentifierExpression = {
  readonly kind: "identifier";
  readonly name: string;
  readonly inferredType?: IrType;
  // Resolved binding for globals (console, Math, etc.)
  readonly resolvedClrType?: string; // e.g., "Tsonic.Runtime.console"
  readonly resolvedAssembly?: string; // e.g., "Tsonic.Runtime"
  readonly csharpName?: string; // Optional: renamed identifier in C# (from binding)
  // For imported symbols from local modules
  readonly importedFrom?: {
    readonly containerName: string; // e.g., "Math"
    readonly exportName: string; // e.g., "add" (may differ from local name if aliased)
    readonly namespace: string; // e.g., "MultiFileCheck.utils"
  };
};

export type IrArrayExpression = {
  readonly kind: "array";
  readonly elements: readonly (IrExpression | IrSpreadExpression | undefined)[]; // undefined for holes
  readonly inferredType?: IrType;
};

export type IrObjectExpression = {
  readonly kind: "object";
  readonly properties: readonly IrObjectProperty[];
  readonly inferredType?: IrType;
  /** Contextual CLR type for object literals in typed positions (return, assignment, etc.) */
  readonly contextualClrType?: string;
};

export type IrObjectProperty =
  | {
      readonly kind: "property";
      readonly key: string | IrExpression;
      readonly value: IrExpression;
      readonly shorthand: boolean;
    }
  | { readonly kind: "spread"; readonly expression: IrExpression };

export type IrFunctionExpression = {
  readonly kind: "functionExpression";
  readonly name?: string;
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly inferredType?: IrType;
};

export type IrArrowFunctionExpression = {
  readonly kind: "arrowFunction";
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement | IrExpression;
  readonly isAsync: boolean;
  readonly inferredType?: IrType;
};

export type IrMemberExpression = {
  readonly kind: "memberAccess";
  readonly object: IrExpression;
  readonly property: IrExpression | string;
  readonly isComputed: boolean; // true for obj[prop], false for obj.prop
  readonly isOptional: boolean; // true for obj?.prop
  readonly inferredType?: IrType;
  // Hierarchical member binding (from bindings manifest)
  // When a member access like systemLinq.enumerable.selectMany is resolved,
  // this contains the full CLR binding info
  readonly memberBinding?: {
    readonly assembly: string; // e.g., "System.Linq"
    readonly type: string; // Full CLR type e.g., "System.Linq.Enumerable"
    readonly member: string; // CLR member name e.g., "SelectMany"
  };
};

export type IrCallExpression = {
  readonly kind: "call";
  readonly callee: IrExpression;
  readonly arguments: readonly (IrExpression | IrSpreadExpression)[];
  readonly isOptional: boolean; // true for func?.()
  readonly inferredType?: IrType;
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
  readonly argumentPassing?: readonly ("value" | "ref" | "out" | "in")[]; // Passing mode for each argument
};

export type IrNewExpression = {
  readonly kind: "new";
  readonly callee: IrExpression;
  readonly arguments: readonly (IrExpression | IrSpreadExpression)[];
  readonly inferredType?: IrType;
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
};

export type IrThisExpression = {
  readonly kind: "this";
  readonly inferredType?: IrType;
};

export type IrUpdateExpression = {
  readonly kind: "update";
  readonly operator: "++" | "--";
  readonly prefix: boolean;
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrUnaryExpression = {
  readonly kind: "unary";
  readonly operator: "+" | "-" | "!" | "~" | "typeof" | "void" | "delete";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrBinaryExpression = {
  readonly kind: "binary";
  readonly operator: IrBinaryOperator;
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
};

export type IrLogicalExpression = {
  readonly kind: "logical";
  readonly operator: "&&" | "||" | "??";
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
};

export type IrConditionalExpression = {
  readonly kind: "conditional";
  readonly condition: IrExpression;
  readonly whenTrue: IrExpression;
  readonly whenFalse: IrExpression;
  readonly inferredType?: IrType;
};

export type IrAssignmentExpression = {
  readonly kind: "assignment";
  readonly operator: IrAssignmentOperator;
  readonly left: IrExpression | IrPattern;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
};

export type IrTemplateLiteralExpression = {
  readonly kind: "templateLiteral";
  readonly quasis: readonly string[];
  readonly expressions: readonly IrExpression[];
  readonly inferredType?: IrType;
};

export type IrSpreadExpression = {
  readonly kind: "spread";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrAwaitExpression = {
  readonly kind: "await";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
};

export type IrYieldExpression = {
  readonly kind: "yield";
  readonly expression?: IrExpression; // Optional for bare `yield`
  readonly delegate: boolean; // true for `yield*`, false for `yield`
  readonly inferredType?: IrType;
};
