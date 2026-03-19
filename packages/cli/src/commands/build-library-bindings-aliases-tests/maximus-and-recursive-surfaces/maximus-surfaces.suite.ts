import { describe, it } from "mocha";
import { assertMaximusBindings } from "./assertions.js";
import { setupMaximusWorkspace } from "./fixture.js";
import { buildTestTimeoutMs, withMaximusWorkspace } from "./helpers.js";

describe("build command (library bindings)", function () {
  this.timeout(buildTestTimeoutMs);

  it("preserves Maximus lowered type/value surfaces across dependency bindings", () => {
    withMaximusWorkspace((dir) => {
      const setup = setupMaximusWorkspace(dir);
      if (!setup.ok) {
        throw new Error(setup.error);
      }
      assertMaximusBindings(setup.value);
    });
  });
});
