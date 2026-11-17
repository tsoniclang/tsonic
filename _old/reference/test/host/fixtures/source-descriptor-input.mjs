import assert from "node:assert/strict";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createSourceNodeInventory } from "../../../packages/target-api/dist/public/host.js";
import { createSourceCoreInput, selectTsonicFixedArray } from "../../../packages/source-core/dist/public/host.js";
import { createSourceDescriptorInput } from "../../../packages/host/dist/host-input/descriptor-factory.js";

export function sourceDescriptorInputFixture(files) {
  const session = createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } });
  const checked = session.checkSource();
  assert.equal(checked.diagnostics.filter(value => value !== undefined).length, 0,
    "the original input boundary fixture checks without diagnostics");
  const { ast } = checked;
  const inventory = createSourceNodeInventory(checked, checked.programSourceFiles);
  const assertNode = node => {
    if (!inventory.contains(node)) throw new Error("The input fixture requires its exact original node.");
  };
  let core;
  const raw = createSourceDescriptorInput({ checked, assertNode, markers: node => core.markers(node),
    extent(component, authoredTypeNode, observed) {
      const terminal = observed(component);
      if (terminal === undefined) return undefined;
      const file = ast.getSourceFile(component.root);
      assert.equal(file !== undefined, true);
      const selected = selectTsonicFixedArray(terminal, checked.getSourceFileQueries(file), checked.sourceFacts,
        authoredTypeNode === undefined ? {} : { authoredTypeNode });
      if (selected?.kind === "invalid") throw new Error(selected.reason);
      return selected === undefined ? undefined : { length: selected.fact.length, runtimeBase: selected.fact.lengthRuntimeBase };
    } });
  core = createSourceCoreInput({ checked, assertNode, observedComponent: raw.identities.checkedComponent,
    syntax: raw.input.syntax, safetyProviders: [], originalApplication: raw.calls.originalApplication,
    originalComponent: raw.calls.originalComponent });
  return { session, checked, ast, inventory, assertNode, ...raw };
}
