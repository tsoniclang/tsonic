import type { uint } from "@tsonic/core/types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/types.go::type::ParseFlags","kind":"type","status":"implemented","sigHash":"351ebf721cd2754016dc44fcbdf16dc89d33b4fc6a92eed1f9db4696eed47fcd","bodyHash":"ec2c138c6126fd16db739ef0b467090e9d970a145b42a30cb3dfebf6b442776b"}
 *
 * Go source:
 * ParseFlags uint32
 */
export type ParseFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/types.go::constGroup::ParseFlagsNone+ParseFlagsYield+ParseFlagsAwait+ParseFlagsType+ParseFlagsIgnoreMissingOpenBrace+ParseFlagsJSDoc","kind":"constGroup","status":"implemented","sigHash":"c1c0a30e1330ab6084823a9cec03c70fecd0e68844959d06e1c3bb28f6b7c3c3","bodyHash":"304b8d76415a4fb4ebbf1b0bdb9808b96888c28ca1f5ff5da235c83e6e82610a"}
 *
 * Go source:
 * const (
 * 	ParseFlagsNone                   ParseFlags = 0
 * 	ParseFlagsYield                  ParseFlags = 1 << 0
 * 	ParseFlagsAwait                  ParseFlags = 1 << 1
 * 	ParseFlagsType                   ParseFlags = 1 << 2
 * 	ParseFlagsIgnoreMissingOpenBrace ParseFlags = 1 << 4
 * 	ParseFlagsJSDoc                  ParseFlags = 1 << 5
 * )
 */
export const ParseFlagsNone: ParseFlags = 0;
export const ParseFlagsYield: ParseFlags = 1 << 0;
export const ParseFlagsAwait: ParseFlags = 1 << 1;
export const ParseFlagsType: ParseFlags = 1 << 2;
export const ParseFlagsIgnoreMissingOpenBrace: ParseFlags = 1 << 4;
export const ParseFlagsJSDoc: ParseFlags = 1 << 5;
