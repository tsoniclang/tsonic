import type { int } from "@tsonic/core/types.js";
import type { GoSlice } from "../../go/compat.js";
import { Fprintln } from "../../go/fmt.js";
import { Stderr } from "../../go/os.js";
import type { Writer } from "../../go/io.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/api.go::func::runAPI","kind":"func","status":"implemented","sigHash":"e5bfc5b29320bc814de28ccc5bc4829d6f7e2446abde14a29e8b3a1d8aeabd67","bodyHash":"e1053cd6cbd7e15396b71272fad8c91707c3924b3488e8ee78e9dbb882a74f8e"}
 *
 * Go source:
 * func runAPI(args []string) int {
 * 	flag := flag.NewFlagSet("api", flag.ContinueOnError)
 * 	cwd := flag.String("cwd", core.Must(os.Getwd()), "current working directory")
 * 	pipePath := flag.String("pipe", "", "use named pipe or Unix domain socket for communication instead of stdio")
 * 	callbacks := flag.String("callbacks", "", "comma-separated list of FS callbacks to enable (readFile,fileExists,directoryExists,getAccessibleEntries,realpath)")
 * 	async := flag.Bool("async", false, "use JSON-RPC protocol instead of MessagePack (for async API)")
 * 	if err := flag.Parse(args); err != nil {
 * 		return 2
 * 	}
 * 
 * 	defaultLibraryPath := bundled.LibPath()
 * 
 * 	// Parse callbacks list
 * 	var callbacksList []string
 * 	if *callbacks != "" {
 * 		callbacksList = strings.Split(*callbacks, ",")
 * 	}
 * 
 * 	options := &api.StdioServerOptions{
 * 		Err:                os.Stderr,
 * 		Cwd:                *cwd,
 * 		DefaultLibraryPath: defaultLibraryPath,
 * 		Callbacks:          callbacksList,
 * 		Async:              *async,
 * 	}
 * 	if *pipePath != "" {
 * 		options.PipePath = *pipePath
 * 	} else {
 * 		options.In = os.Stdin
 * 		options.Out = os.Stdout
 * 	}
 * 
 * 	s := api.NewStdioServer(options)
 * 
 * 	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
 * 	defer stop()
 * 
 * 	if err := s.Run(ctx); err != nil {
 * 		fmt.Fprintln(os.Stderr, err)
 * 		return 1
 * 	}
 * 	return 0
 * }
 */
export function runAPI(args: GoSlice<string>): int {
  Fprintln(Stderr as Writer, `--api is outside the standalone compiler surface (${args.length} argument(s) ignored)`);
  return 1 as int;
}
