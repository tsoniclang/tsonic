/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/enablevtprocessing_windows.go::func::init","kind":"func","status":"implemented","sigHash":"deadcfe2223147229491ed97a5eb1b413a0acb92061a6dd7ca510eb6614543db","bodyHash":"b5eab2e107ed4348c3996f517d2014aa4a2f19948a46ccf9c0b7e86623587411"}
 *
 * Go source:
 * func init() {
 * 	h, err := windows.GetStdHandle(windows.STD_OUTPUT_HANDLE)
 * 	if err != nil || h == windows.InvalidHandle {
 * 		return
 * 	}
 * 	fileType, err := windows.GetFileType(h)
 * 	if err != nil || fileType == windows.FILE_TYPE_CHAR {
 * 		var mode uint32
 * 		if err := windows.GetConsoleMode(h, &mode); err != nil {
 * 			return
 * 		}
 * 		if mode&windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING == 0 {
 * 			_ = windows.SetConsoleMode(h, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING)
 * 		}
 * 	}
 * }
 */
export function init(): void {
  return;
}
