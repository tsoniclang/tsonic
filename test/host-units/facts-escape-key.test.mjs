import { test } from "node:test";
import { escapeKeyCases } from "./fixtures/facts-escape-key.mjs";

test("Facts publishes its existing paid canonical EscapeTarget ordering", escapeKeyCases);
