import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";

// The checked program with the provider declaration facts of one selected virtual operation replaced: `signature` (the
// selected signature declaration) gets `identity`, `binding` (the declaration its receiver names) gets `bindingIdentity`.
// The Host program built from it reads these facts in every owner (facts.profile and the storage analysis alike).
export function nativeStorageOperationCheckedSource(checked, { signature, binding }, identity, bindingIdentity) {
  if (signature === undefined || binding === undefined) throw new Error("Exact selected virtual operation and runtime binding are required.");
  const facts = checked.sourceFacts;
  return Object.freeze({
    ...checked,
    sourceFacts: Object.freeze({
      getFact: (subject, key) => key !== providerVirtualDeclarationFactKey ? facts.getFact(subject, key)
        : subject === signature ? identity : subject === binding ? bindingIdentity : facts.getFact(subject, key),
      getFacts: subject => facts.getFacts(subject),
      getVirtualDeclarationDocument: name => facts.getVirtualDeclarationDocument(name),
    }),
  });
}

export const nativeStorageVirtualOperationSource = `interface RemoteConstructor { freeze<Value>(value: Value): Value; }
  declare const remote: RemoteConstructor; const original = {}; const frozen = remote.freeze(original);`;

export const nativeStorageOperationAuthoritySource = `
const token: object = {};
const receiver = Object;
const freeze = receiver.freeze;
const owned = Object.freeze(token);
const ownedAlias = freeze(token);
export function foreignMember(factory: ObjectConstructor): object {
  const local: object = {};
  const externalMember = factory.freeze(local);
  return externalMember;
}
export function foreignFunction(operation: typeof Object.freeze): object {
  const local: object = {};
  const externalFunction = operation(local);
  return externalFunction;
}
export function foreignPreservation(factory: ObjectConstructor): boolean {
  const holder: { value: object } = { value: {} };
  factory.freeze(holder);
  const externalPreserved = holder.value;
  return Object.isFrozen(externalPreserved);
}
`;
