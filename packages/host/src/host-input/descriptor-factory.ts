import type { CheckedSourceProgram, Node } from "@tsonic/tsts";
import type { SourceDescriptorInput, SourceInputComponent, SourceInputMarkerQueries } from "@tsonic/target-api/host";
import { createSourceCallInput } from "./call-input.js";
import { createSourceDescriptorFacts } from "./descriptor-facts.js";
import { createSourceInputIdentityOwner } from "./identity-owner.js";
import { createSourceMemberUseInput } from "./member-use.js";

export function createSourceDescriptorInput(options: {
  readonly checked: CheckedSourceProgram;
  readonly markers: SourceInputMarkerQueries["markers"];
  assertNode(node: Node): void;
  extent(component: SourceInputComponent, authoredTypeNode: Node | undefined,
    observed: ReturnType<typeof createSourceInputIdentityOwner>["checkedComponent"]): { readonly length: bigint; readonly runtimeBase: "number" | "bigint" } | undefined;
}) {
  const identities = createSourceInputIdentityOwner(options.assertNode);
  const facts = createSourceDescriptorFacts({ checked: options.checked, identities, assertNode: options.assertNode,
    extent: (component, authoredTypeNode) => options.extent(component, authoredTypeNode, identities.checkedComponent) });
  const calls = createSourceCallInput({ checked: options.checked, identities, facts, assertNode: options.assertNode });
  const input: SourceDescriptorInput = Object.freeze({ ast: options.checked.ast, assertNode: options.assertNode, markers: options.markers,
    assertComponent: identities.assertComponent, assertSignature: identities.assertSignature,
    syntax: facts.syntax, describe: facts.describe, members: facts.members, describeSignature: facts.describeSignature,
    signatureForDeclaration: facts.signatureForDeclaration, signatureComponent: facts.signatureComponent,
    application: calls.application, constraints: calls.constraints, enumDeclaration: facts.enumDeclaration });
  const memberUse = createSourceMemberUseInput({ checked: options.checked, identities, assertNode: options.assertNode,
    syntax: input.syntax, describe: input.describe, originalSignature: facts.originalSignature });
  return Object.freeze({ input, identities, calls, facts, memberUse });
}
