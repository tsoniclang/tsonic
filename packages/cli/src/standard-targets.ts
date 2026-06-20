import { createTargetRegistry } from "@tsonic/target-api";
import { createCsharpTargetPack } from "@tsonic/target-csharp";

export function createStandardTargetRegistry() {
  return createTargetRegistry([
    createCsharpTargetPack(),
  ]);
}
