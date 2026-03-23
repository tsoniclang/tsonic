/**
 * Receiver binding resolution for call expressions.
 * Recovers member bindings when the frontend did not attach one.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";

type ReceiverMemberBinding = NonNullable<
  Extract<IrExpression, { kind: "memberAccess" }>["memberBinding"]
> & {
  readonly parameterCount?: number;
  readonly semanticSignature?: {
    readonly parameters: readonly {
      readonly type?: IrType;
      readonly isOptional?: boolean;
      readonly initializer?: unknown;
    }[];
  };
};

type ReceiverBindingLookupMember = {
  readonly kind: "method" | "property";
  readonly alias?: string;
  readonly name?: string;
  readonly binding?: {
    readonly assembly: string;
    readonly type: string;
    readonly member: string;
  };
  readonly parameterModifiers?: readonly {
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }[];
  readonly isExtensionMethod?: boolean;
  readonly emitSemantics?: {
    readonly callStyle: "receiver" | "static";
  };
  readonly semanticSignature?: {
    readonly parameters: readonly {
      readonly type?: IrType;
      readonly isOptional?: boolean;
      readonly initializer?: unknown;
    }[];
  };
  readonly parameterCount?: number;
};

const normalizeBindingLookupName = (name: string | undefined): string[] => {
  if (!name) return [];
  const values = new Set<string>();
  const push = (value: string | undefined): void => {
    if (!value) return;
    values.add(value);
    const strippedGlobal = value.replace(/^global::/, "");
    values.add(strippedGlobal);
    const leaf = strippedGlobal.split(".").pop();
    if (leaf) values.add(leaf);
  };

  push(name);
  return Array.from(values);
};

const buildReceiverBindingLookupKeys = (
  receiverType: IrType | undefined,
  context: EmitterContext
): Set<string> => {
  const keys = new Set<string>();
  const pushAll = (values: readonly string[]): void => {
    for (const value of values) {
      for (const normalized of normalizeBindingLookupName(value)) {
        keys.add(normalized);
      }
    }
  };

  if (!receiverType) return keys;

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (resolved.kind === "primitiveType") {
    switch (resolved.name) {
      case "string":
        pushAll([
          "string",
          "String",
          "System.String",
          "Tsonic.JSRuntime.String",
        ]);
        return keys;
      case "number":
        pushAll([
          "number",
          "Number",
          "System.Double",
          "Tsonic.JSRuntime.Number",
        ]);
        return keys;
      case "boolean":
        pushAll([
          "boolean",
          "Boolean",
          "System.Boolean",
          "Tsonic.JSRuntime.Boolean",
          "Tsonic.JSRuntime.BooleanOps",
        ]);
        return keys;
    }
  }

  if (resolved.kind === "literalType") {
    switch (typeof resolved.value) {
      case "string":
        pushAll([
          "string",
          "String",
          "System.String",
          "Tsonic.JSRuntime.String",
        ]);
        return keys;
      case "number":
        pushAll([
          "number",
          "Number",
          "System.Double",
          "Tsonic.JSRuntime.Number",
        ]);
        return keys;
      case "boolean":
        pushAll([
          "boolean",
          "Boolean",
          "System.Boolean",
          "Tsonic.JSRuntime.Boolean",
          "Tsonic.JSRuntime.BooleanOps",
        ]);
        return keys;
    }
  }

  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    pushAll(["Array", "ReadonlyArray", "JSArray", "System.Array"]);
    return keys;
  }

  if (resolved.kind === "referenceType") {
    pushAll(normalizeBindingLookupName(resolved.name));
    pushAll(normalizeBindingLookupName(resolved.resolvedClrType));
    pushAll(normalizeBindingLookupName(resolved.typeId?.tsName));
    pushAll(normalizeBindingLookupName(resolved.typeId?.clrName));

    if (resolved.name === "Array" || resolved.name === "ReadonlyArray") {
      pushAll(["JSArray", "System.Array"]);
    }
  }

  return keys;
};

const bindingMemberMatchesName = (
  binding: ReceiverBindingLookupMember,
  memberName: string
): boolean =>
  binding.name === memberName ||
  binding.alias === memberName ||
  binding.binding?.member === memberName ||
  binding.binding?.type?.endsWith(`.${memberName}`) === true;

const bindingMatchesArgumentCount = (
  binding: ReceiverBindingLookupMember,
  argumentCount: number
): boolean => {
  const semanticParams = binding.semanticSignature?.parameters;
  if (semanticParams && semanticParams.length > 0) {
    const required = semanticParams.filter(
      (parameter) => !parameter.isOptional && !parameter.initializer
    ).length;
    return argumentCount >= required && argumentCount <= semanticParams.length;
  }

  if (binding.parameterCount === undefined) {
    return true;
  }

  const tsParameterCount =
    binding.parameterCount - (binding.isExtensionMethod ? 1 : 0);
  return argumentCount <= tsParameterCount;
};

const collapseResolvedReceiverBinding = (
  overloads: readonly ReceiverBindingLookupMember[]
): ReceiverMemberBinding | undefined => {
  const first = overloads[0];
  if (!first) return undefined;

  const getTargetKey = (binding: ReceiverBindingLookupMember): string =>
    `${binding.binding?.assembly}:${binding.binding?.type}::${binding.binding?.member}`;
  const targetKey = getTargetKey(first);
  if (overloads.some((binding) => getTargetKey(binding) !== targetKey)) {
    return undefined;
  }

  const getModifiersKey = (binding: ReceiverBindingLookupMember): string => {
    const modifiers = binding.parameterModifiers ?? [];
    if (modifiers.length === 0) return "";
    return [...modifiers]
      .sort((left, right) => left.index - right.index)
      .map((modifier) => `${modifier.index}:${modifier.modifier}`)
      .join(",");
  };

  const modifiersKey = getModifiersKey(first);
  const consistentModifiers = overloads.every(
    (binding) => getModifiersKey(binding) === modifiersKey
  );

  return {
    kind: first.kind,
    assembly: first.binding?.assembly ?? "",
    type: first.binding?.type ?? "",
    member: first.binding?.member ?? first.name ?? first.alias ?? "",
    parameterModifiers:
      consistentModifiers &&
      first.parameterModifiers &&
      first.parameterModifiers.length > 0
        ? first.parameterModifiers
        : undefined,
    isExtensionMethod: first.isExtensionMethod,
    emitSemantics: first.emitSemantics,
    parameterCount: first.parameterCount,
    semanticSignature: first.semanticSignature,
  };
};

const resolveRecoveredReceiverBinding = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): ReceiverMemberBinding | undefined => {
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.memberBinding) return expr.callee.memberBinding;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;
  if (expr.callee.object.kind === "identifier") {
    const importBinding = context.importBindings?.get(expr.callee.object.name);
    if (importBinding?.kind === "type") {
      return undefined;
    }

    if (context.localTypes?.has(expr.callee.object.name)) {
      return undefined;
    }
  }

  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) return undefined;

  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  const receiverKeys = buildReceiverBindingLookupKeys(receiverType, context);
  if (receiverKeys.size === 0) return undefined;

  const matches: ReceiverBindingLookupMember[] = [];
  for (const binding of registry.values()) {
    const bindingKeys = new Set<string>([
      ...normalizeBindingLookupName(binding.alias),
      ...normalizeBindingLookupName(binding.name),
    ]);
    const matchesReceiver = Array.from(bindingKeys).some((key) =>
      receiverKeys.has(key)
    );
    if (!matchesReceiver) continue;

    for (const member of binding.members) {
      if (member.kind !== "method") continue;
      if (!bindingMemberMatchesName(member, expr.callee.property)) continue;
      if (!bindingMatchesArgumentCount(member, expr.arguments.length)) continue;
      matches.push(member);
    }
  }

  return collapseResolvedReceiverBinding(matches);
};

const isPrimitiveReceiverExtensionCall = (
  receiverType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!receiverType) return false;
  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  return (
    resolved.kind === "primitiveType" ||
    resolved.kind === "literalType" ||
    (resolved.kind === "referenceType" &&
      (resolved.resolvedClrType === "System.String" ||
        resolved.resolvedClrType === "System.Double" ||
        resolved.resolvedClrType === "System.Boolean" ||
        resolved.name === "String" ||
        resolved.name === "Double" ||
        resolved.name === "Boolean"))
  );
};

export { resolveRecoveredReceiverBinding, isPrimitiveReceiverExtensionCall };
export type { ReceiverMemberBinding };
