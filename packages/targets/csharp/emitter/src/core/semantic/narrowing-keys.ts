import { IrExpression } from "@tsonic/frontend";

const sanitizeNarrowStem = (name: string): string => {
  const sanitized = name
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized : "narrowed";
};

export const getMemberAccessNarrowKey = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>
): string | undefined => {
  if (expr.isComputed) return undefined;
  if (typeof expr.property !== "string") return undefined;

  const obj = expr.object;
  if (obj.kind === "identifier") {
    return `${obj.name}.${expr.property}`;
  }

  if (obj.kind === "memberAccess") {
    const prefix = getMemberAccessNarrowKey(obj);
    return prefix ? `${prefix}.${expr.property}` : undefined;
  }

  if (obj.kind === "this") {
    return `this.${expr.property}`;
  }

  return undefined;
};

export const makeNarrowedLocalName = (
  originalName: string,
  marker: string | number,
  tempVarId: number
): string => `${sanitizeNarrowStem(originalName)}__${marker}_${tempVarId}`;
