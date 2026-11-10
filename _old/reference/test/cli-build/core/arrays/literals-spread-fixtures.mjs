import { access } from "node:fs/promises";
import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

function assertArraySpreadCopies(source, inputs) {
  const copies = [...source.matchAll(/Tsonic\.CSharp\.Js\.JSArray<int> (?<source>__tsonic_sequence_\d+) = (?<input>[A-Za-z][A-Za-z0-9:.]*);\s*(?<destination>_*tsonic_sequence_destination)\.EnsureCapacity\(checked\(\k<destination>\.Count \+ \k<source>\.length\)\);\s*for \(int (?<index>_*tsonic_sequence_index) = 0; \k<index> < \k<source>\.length; \k<index>\+\+\)\s*\{\s*\k<destination>\.Add\(\k<source>\[\k<index>\]\);\s*\}/gu)];
  assert.deepEqual(copies.map(copy => copy.groups.input), inputs);
  return copies.map(copy => copy.groups.destination);
}

export { assertArraySpreadCopies };
