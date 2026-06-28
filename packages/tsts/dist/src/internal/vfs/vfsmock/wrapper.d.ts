import type { GoPtr } from "../../../go/compat.js";
import type { FS } from "../vfs.js";
import type { FSMock } from "./mock_generated.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/wrapper.go::func::Wrap","kind":"func","status":"implemented","sigHash":"462f048fe139267a07e0cf63f1bda61dc164bb450051a3a8e807e726d4b1c98d","bodyHash":"135dd53eb3273b1c82f5256de18b6f75aef7923d2e89150db626b7e683c66209"}
 *
 * Go source:
 * func Wrap(fs vfs.FS) *FSMock {
 * 	return &FSMock{
 * 		DirectoryExistsFunc:           fs.DirectoryExists,
 * 		FileExistsFunc:                fs.FileExists,
 * 		GetAccessibleEntriesFunc:      fs.GetAccessibleEntries,
 * 		ReadFileFunc:                  fs.ReadFile,
 * 		RealpathFunc:                  fs.Realpath,
 * 		RemoveFunc:                    fs.Remove,
 * 		ChtimesFunc:                   fs.Chtimes,
 * 		StatFunc:                      fs.Stat,
 * 		UseCaseSensitiveFileNamesFunc: fs.UseCaseSensitiveFileNames,
 * 		WalkDirFunc:                   fs.WalkDir,
 * 		WriteFileFunc:                 fs.WriteFile,
 * 		AppendFileFunc:                fs.AppendFile,
 * 	}
 * }
 */
export declare function Wrap(fs: FS): GoPtr<FSMock>;
//# sourceMappingURL=wrapper.d.ts.map