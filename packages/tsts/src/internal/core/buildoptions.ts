import type { int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { noCopy } from "./compileroptions.js";
import type { Tristate } from "./tristate.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/buildoptions.go::type::BuildOptions","kind":"type","status":"implemented","sigHash":"ba7b8c9b824a7fa2f401dfcf231296b22b0d81902ca437b9390ae2ea448f032c","bodyHash":"f27845d308765682fbd60c4beebec49b9af23184ed41b9ec8cd4399ea433931c"}
 *
 * Go source:
 * BuildOptions struct {
 * 	_ noCopy
 * 
 * 	Dry               Tristate `json:"dry,omitzero"`
 * 	Force             Tristate `json:"force,omitzero"`
 * 	Verbose           Tristate `json:"verbose,omitzero"`
 * 	Builders          *int     `json:"builders,omitzero"`
 * 	StopBuildOnErrors Tristate `json:"stopBuildOnErrors,omitzero"`
 * 
 * 	// CompilerOptions are not parsed here and will be available on ParsedBuildCommandLine
 * 
 * 	// Internal fields
 * 	Clean Tristate `json:"clean,omitzero"`
 * }
 */
export interface BuildOptions {
  __tsgoBlank0: noCopy;
  Dry: Tristate;
  Force: Tristate;
  Verbose: Tristate;
  Builders: GoPtr<int>;
  StopBuildOnErrors: Tristate;
  Clean: Tristate;
}
