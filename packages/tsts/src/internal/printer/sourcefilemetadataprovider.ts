import type { GoPtr } from "../../go/compat.js";
import type { SourceFileMetaData } from "../ast/ast.js";
import type { Path } from "../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/sourcefilemetadataprovider.go::type::SourceFileMetaDataProvider","kind":"type","status":"implemented","sigHash":"dec5acbce743debd2355b308dc90d34fc6f1c708d998e32c343f475ec828b87d","bodyHash":"3bd2700fa6ad3722aa5d69cb8558690d00cc8872e987860989c2ea38e4cb23fb"}
 *
 * Go source:
 * SourceFileMetaDataProvider interface {
 * 	GetSourceFileMetaData(path tspath.Path) *ast.SourceFileMetaData
 * }
 */
export interface SourceFileMetaDataProvider {
  GetSourceFileMetaData(path: Path): GoPtr<SourceFileMetaData>;
}
