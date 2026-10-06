import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the bounded process launcher preserves literal child arguments", () => {
  const script = readFileSync(new URL("../scripts/bounded-run.sh", import.meta.url), "utf8");
  const invocation = script.slice(script.indexOf("  systemd-run \\\n"), script.indexOf("test_runner_pid=$!"));
  assert.match(invocation, /^\s*--expand-environment=no \\/mu);
  assert.match(invocation, /^\s*env -u TSONIC_TEST_GUARD_REPORT "\$@" \\/mu);
  assert.doesNotMatch(invocation, /\beval\b/u);
});
