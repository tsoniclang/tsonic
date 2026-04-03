import { Assert } from "xunit-types/Xunit.js";
import type { JsValue } from "@tsonic/core/types.js";

export function run(received: JsValue): void {
  Assert.Equal(42, received);
}
