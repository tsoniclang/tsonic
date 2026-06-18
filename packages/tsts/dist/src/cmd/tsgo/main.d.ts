import type { int } from "@tsonic/core/types.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/main.go::func::main","kind":"func","status":"implemented","sigHash":"951d36fc88d8e4b47cb98a3e2fe2daad7f263004100af9df82bcd02d9da90120","bodyHash":"2f9430edbb4cdc213d44c2d06f9df841c32b3c188563b434726a94b86b9c6209"}
 *
 * Go source:
 * func main() {
 * 	os.Exit(runMain())
 * }
 */
export declare function main(): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/main.go::func::runMain","kind":"func","status":"implemented","sigHash":"7a440dbeaa39ecf531185f0c253125a97b7e7dd79e07179c951f6b2809023b4f","bodyHash":"4c0d9be47470ffc9adb6769aaa63e17f07ad553c1d92b744e591b11f2fa6d9fb"}
 *
 * Go source:
 * func runMain() int {
 * 	args := os.Args[1:]
 * 	if len(args) > 0 {
 * 		switch args[0] {
 * 		case "--lsp":
 * 			return runLSP(args[1:])
 * 		case "--api":
 * 			return runAPI(args[1:])
 * 		}
 * 	}
 * 	result := execute.CommandLine(newSystem(), args, nil)
 * 	return int(result.Status)
 * }
 */
export declare function runMain(): int;
//# sourceMappingURL=main.d.ts.map