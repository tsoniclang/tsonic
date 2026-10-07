import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";

export function nativeStorageOperationFactSource(source, selected, identity, bindingIdentity) {
  const declaration = source.semantics.forNode(selected.call).declarations.signatureDeclaration(selected.selectedSignature);
  const binding = selected.sourceCalleeAccess?.receiver.declaration ?? selected.sourceReceiver?.declaration;
  if (declaration === undefined || binding === undefined) throw new Error("Exact selected virtual operation and runtime binding are required.");
  const facts = source.sourceFacts;
  return Object.freeze({
    ...source,
    sourceFacts: Object.freeze({
      getFact: (subject, key) => key !== providerVirtualDeclarationFactKey ? facts.getFact(subject, key)
        : subject === declaration ? identity : subject === binding ? bindingIdentity : facts.getFact(subject, key),
      getFacts: subject => facts.getFacts(subject),
      getVirtualDeclarationDocument: name => facts.getVirtualDeclarationDocument(name),
    }),
  });
}

export const nativeStorageVirtualOperationSource = `interface RemoteConstructor { freeze<Value>(value: Value): Readonly<Value>; }
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
