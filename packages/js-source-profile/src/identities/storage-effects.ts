export interface JsSourceCallStorageEffect {
  readonly resultAliasesParameter?: number;
  readonly preservedParameters: readonly number[];
}

const freeze: JsSourceCallStorageEffect = Object.freeze({
  resultAliasesParameter: 0,
  preservedParameters: Object.freeze([0]),
});
const inspect: JsSourceCallStorageEffect = Object.freeze({ preservedParameters: Object.freeze([0]) });

export function jsSourceCallStorageEffect(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): JsSourceCallStorageEffect | undefined {
  if (identity?.ownerName !== "ObjectConstructor") return undefined;
  return identity.memberName === "freeze" ? freeze : identity.memberName === "isFrozen" ? inspect : undefined;
}
