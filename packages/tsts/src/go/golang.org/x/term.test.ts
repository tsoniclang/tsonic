import type { int } from "../../scalars.js";
import assert from "node:assert/strict";
import test from "node:test";

import { Stdout } from "../../os.js";
import { GetSize, IsTerminal } from "./term.js";

test("term.IsTerminal reports false for an unknown descriptor", () => {
  assert.equal(IsTerminal({ Fd: () => -1 as int }), false);
});

test("term.GetSize returns a Go tuple and error for an unknown descriptor", () => {
  const [width, height, err] = GetSize({ Fd: () => -1 as int });

  assert.equal(width, 0);
  assert.equal(height, 0);
  assert.ok(err instanceof Error);
});

test("term.GetSize accepts the os.File facade used by cmd/tsgo", () => {
  const [width, height] = GetSize(Stdout);

  assert.equal(Number.isInteger(width), true);
  assert.equal(Number.isInteger(height), true);
  assert.equal(width >= 0, true);
  assert.equal(height >= 0, true);
});
