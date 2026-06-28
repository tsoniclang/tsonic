import type { bool, int } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import type { Writer as Writer_155142d5 } from "../../go/io.js";
import type { Duration, Time } from "../../go/time.js";
import type { System } from "../../internal/execute/tsc/compile.js";
import type { FS as FS_12f44eda } from "../../internal/vfs/vfs.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::type::osSys","kind":"type","status":"implemented","sigHash":"4d75e085ec2f5c8a56d334fd32dce412d90f6a22836525e3e62f7f9189aaa0cd","bodyHash":"e8ab6ded0a11312a928fb2891f9a2b5ce63f513343ec46009e53a2f8256e49ac"}
 *
 * Go source:
 * osSys struct {
 * 	writer             io.Writer
 * 	fs                 vfs.FS
 * 	defaultLibraryPath string
 * 	cwd                string
 * 	start              time.Time
 * }
 */
export interface osSys {
    writer: Writer_155142d5;
    fs: FS_12f44eda;
    defaultLibraryPath: string;
    cwd: string;
    start: Time;
}
export declare function osSys_as_tsc_System(receiver: GoPtr<osSys>): System;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.SinceStart","kind":"method","status":"implemented","sigHash":"2c3683ac4ccdad2659ca358efa3c70ab60c54cc6c00b59ada5483db4697daaac","bodyHash":"852b5cc5ef8df888b4e953aeffc424f4d6a37e86fae2b55324493b7ab5e37bdc"}
 *
 * Go source:
 * func (s *osSys) SinceStart() time.Duration {
 * 	return time.Since(s.start)
 * }
 */
export declare function osSys_SinceStart(receiver: GoPtr<osSys>): Duration;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.Now","kind":"method","status":"implemented","sigHash":"2e1bae49e29a3f0846707331e529fc2a717bac7d3b8cd642c9e8e0f0c79de271","bodyHash":"afc5fdca29430c23686d40ceb9cc597584373b5065e3ad46805ff931812e8204"}
 *
 * Go source:
 * func (s *osSys) Now() time.Time {
 * 	return time.Now()
 * }
 */
export declare function osSys_Now(receiver: GoPtr<osSys>): Time;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.FS","kind":"method","status":"implemented","sigHash":"6c104471fb7ee2a699c8ddeadf15911d1cee7cfbcd3cef944567191ebb40750d","bodyHash":"770492aa8dc4a2f72d38a897dc19458d739670be57b393fcd11efd7f3ad4e7fb"}
 *
 * Go source:
 * func (s *osSys) FS() vfs.FS {
 * 	return s.fs
 * }
 */
export declare function osSys_FS(receiver: GoPtr<osSys>): FS_12f44eda;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.DefaultLibraryPath","kind":"method","status":"implemented","sigHash":"7842d329f4225aaec91a2507dc42f475bbe0b5aff334ca434fbdcd191633dcba","bodyHash":"11123a6d329f599786615b69e740e8ca378b338641caf8e6a0c67062525d8392"}
 *
 * Go source:
 * func (s *osSys) DefaultLibraryPath() string {
 * 	return s.defaultLibraryPath
 * }
 */
export declare function osSys_DefaultLibraryPath(receiver: GoPtr<osSys>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.GetCurrentDirectory","kind":"method","status":"implemented","sigHash":"b7899881747dc37ddaf3d1a8ccac92da3aacaceb243e86cf62eecf36d775c082","bodyHash":"5f114f72bcbeb3bfde3a2c27f8b3ee0789db2e7ada3d3536e764b11a5e2a2399"}
 *
 * Go source:
 * func (s *osSys) GetCurrentDirectory() string {
 * 	return s.cwd
 * }
 */
export declare function osSys_GetCurrentDirectory(receiver: GoPtr<osSys>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.Writer","kind":"method","status":"implemented","sigHash":"0df6e068ed2fbc1affed028345ed91ca760e9ba2554e349a59f848968ce427ea","bodyHash":"55d210f20490ff221b1e5ff5c028905e87aff29f7f96b632881cd246fbfa9e00"}
 *
 * Go source:
 * func (s *osSys) Writer() io.Writer {
 * 	return s.writer
 * }
 */
export declare function osSys_Writer(receiver: GoPtr<osSys>): Writer_155142d5;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.WriteOutputIsTTY","kind":"method","status":"implemented","sigHash":"ba8f951d054a1905678905eeea3db9e982699804a7e70924309482a411ffd1a1","bodyHash":"981f9c6aa0a31a4176766edbedb4e6b67cb92b68068144a3ef4d3c46d132e10b"}
 *
 * Go source:
 * func (s *osSys) WriteOutputIsTTY() bool {
 * 	return term.IsTerminal(int(os.Stdout.Fd()))
 * }
 */
export declare function osSys_WriteOutputIsTTY(receiver: GoPtr<osSys>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.GetWidthOfTerminal","kind":"method","status":"implemented","sigHash":"fd8fb4cb459cab4fd8c6133a6a154bb21007250896c3a02e2cb8258c68b570a8","bodyHash":"3f3c9f5637424f51e141d1b0c3ebc438a4af85fd8576b3fbf4c4304f601aa86e"}
 *
 * Go source:
 * func (s *osSys) GetWidthOfTerminal() int {
 * 	width, _, _ := term.GetSize(int(os.Stdout.Fd()))
 * 	return width
 * }
 */
export declare function osSys_GetWidthOfTerminal(receiver: GoPtr<osSys>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::method::osSys.GetEnvironmentVariable","kind":"method","status":"implemented","sigHash":"f932d25ead4ef8ab70ce220638a0b7308308eebc7020a76338b86e0469a83e68","bodyHash":"01a61833d9a458195c08c31ecd54dbed6a97d35f11e4621a99b7aa95ce7f09ee"}
 *
 * Go source:
 * func (s *osSys) GetEnvironmentVariable(name string) string {
 * 	return os.Getenv(name)
 * }
 */
export declare function osSys_GetEnvironmentVariable(receiver: GoPtr<osSys>, name: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/sys.go::func::newSystem","kind":"func","status":"implemented","sigHash":"485297466d3892136b1b48fe12a6d73a3db7acddbe9fd344ed31902139040336","bodyHash":"f59467b10041778d6cdf4510da56c819cc3f7fcf177f6c5b2270aa69d8e57723"}
 *
 * Go source:
 * func newSystem() *osSys {
 * 	cwd, err := os.Getwd()
 * 	if err != nil {
 * 		fmt.Fprintf(os.Stderr, "Error getting current directory: %v\n", err)
 * 		os.Exit(int(tsc.ExitStatusInvalidProject_OutputsSkipped))
 * 	}
 *
 * 	return &osSys{
 * 		cwd:                tspath.NormalizePath(cwd),
 * 		fs:                 bundled.WrapFS(osvfs.FS()),
 * 		defaultLibraryPath: bundled.LibPath(),
 * 		writer:             os.Stdout,
 * 		start:              time.Now(),
 * 	}
 * }
 */
export declare function newSystem(): GoPtr<osSys>;
//# sourceMappingURL=sys.d.ts.map