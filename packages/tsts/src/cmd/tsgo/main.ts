import type { int } from "../../go/scalars.js";
import { Args, Exit, Stderr } from "../../go/os.js";
import { Fprintln } from "../../go/fmt.js";
import type { Writer } from "../../go/io.js";
import { Background } from "../../go/context.js";
import { NotifyContext } from "../../go/os/signal.js";
import { SIGINT, SIGTERM } from "../../go/syscall.js";
import { ApplyDebugStackLimit } from "../../internal/core/core.js";
import { CommandLine } from "../../internal/execute/tsc.js";
import { runAPI } from "./api.js";
import { newSystem, osSys_as_tsc_System } from "./sys.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/main.go::func::main","kind":"func","status":"implemented","sigHash":"951d36fc88d8e4b47cb98a3e2fe2daad7f263004100af9df82bcd02d9da90120","bodyHash":"2f9430edbb4cdc213d44c2d06f9df841c32b3c188563b434726a94b86b9c6209"}
 *
 * Go source:
 * func main() {
 * 	os.Exit(runMain())
 * }
 */
export function main(): void {
  Exit(runMain());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/main.go::func::runMain","kind":"func","status":"implemented","sigHash":"7a440dbeaa39ecf531185f0c253125a97b7e7dd79e07179c951f6b2809023b4f","bodyHash":"3bd2c285d68f3f611a0d3e8a32047678eb112e0fa7a7829b7cb8d2c53388610b"}
 *
 * Go source:
 * func runMain() int {
 * 	core.ApplyDebugStackLimit()
 * 	args := os.Args[1:]
 * 	if len(args) > 0 {
 * 		switch args[0] {
 * 		case "--lsp":
 * 			return runLSP(args[1:])
 * 		case "--api":
 * 			return runAPI(args[1:])
 * 		}
 * 	}
 * 	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
 * 	defer stop()
 * 	result := execute.CommandLine(ctx, newSystem(), args, nil)
 * 	return int(result.Status)
 * }
 */
export function runMain(): int {
  ApplyDebugStackLimit();
  const args = Args.slice(1);
  if (args.length > 0) {
    switch (args[0]) {
      case "--lsp":
        Fprintln(Stderr as Writer, "language service mode is outside the standalone compiler scope");
        return 1 as int;
      case "--api":
        return runAPI(args.slice(1));
    }
  }
  const [ctx, stop] = NotifyContext(Background(), SIGINT as NodeJS.Signals, SIGTERM as NodeJS.Signals);
  try {
    const result = CommandLine(ctx, osSys_as_tsc_System(newSystem()), args, undefined);
    return result.Status as int;
  } finally {
    stop();
  }
}
