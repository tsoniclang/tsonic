import { attributes as A } from "@tsonic/core/lang.js";
import { add } from "../index.ts";

import { Assert, FactAttribute } from "xunit-types/Xunit.js";

export class MathTests {
  public add_numbers(): void {
    Assert.Equal(3, add(1, 2));
  }
}

A.on(MathTests)
  .method((t) => t.add_numbers)
  .add(FactAttribute);
