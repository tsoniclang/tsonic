import type { bool } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { NewOrderedMapWithSizeHint, OrderedMap_GetOrZero, OrderedMap_Set } from "../collections/ordered_map.js";
import * as strings from "../../go/strings.js";
import type { CommandLineOption } from "./commandlineoption.js";
import { OptionsDeclarations } from "./declscompiler.js";
import { BuildOpts } from "./declsbuild.js";
import { OptionsForWatch } from "./declswatch.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/namemap.go::varGroup::CompilerNameMap+BuildNameMap+WatchNameMap","kind":"varGroup","status":"implemented","sigHash":"d36f731b41d885eadcd726db4ea35887a601a6a57421910d7c4811456e2f0cbe","bodyHash":"382aad0d92db6ed0fce61aa68cb234eef72cfef3c64b20046ae47a146751e2a8"}
 *
 * Go source:
 * var (
 * 	CompilerNameMap = GetNameMapFromList(OptionsDeclarations)
 * 	BuildNameMap    = GetNameMapFromList(BuildOpts)
 * 	WatchNameMap    = GetNameMapFromList(OptionsForWatch)
 * )
 */
// Go initializes package-level vars by dependency order; these depend on
// OptionsDeclarations, BuildOpts, and OptionsForWatch (defined in other files
// with late assignments), so they are assigned after those declarations.
export let CompilerNameMap: GoPtr<NameMap> = undefined;
export let BuildNameMap: GoPtr<NameMap> = undefined;
export let WatchNameMap: GoPtr<NameMap> = undefined;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/namemap.go::func::GetNameMapFromList","kind":"func","status":"implemented","sigHash":"06ddc8e3ab68388bc725a46d40a8fb6c4b86970f9736dd6d231c58ecfa81e1de","bodyHash":"a8eb468b647e920f49036ceffb2441326909814b7c7b62d8715adf78a31d67f1"}
 *
 * Go source:
 * func GetNameMapFromList(optDecls []*CommandLineOption) *NameMap {
 * 	optionsNames := collections.NewOrderedMapWithSizeHint[string, *CommandLineOption](len(optDecls))
 * 	shortOptionNames := map[string]string{}
 * 	for _, option := range optDecls {
 * 		optionsNames.Set(strings.ToLower(option.Name), option)
 * 		if option.ShortName != "" {
 * 			shortOptionNames[option.ShortName] = option.Name
 * 		}
 * 	}
 * 	return &NameMap{
 * 		optionsNames:     optionsNames,
 * 		shortOptionNames: shortOptionNames,
 * 	}
 * }
 */
export function GetNameMapFromList(optDecls: GoSlice<GoPtr<CommandLineOption>>): GoPtr<NameMap> {
  const optionsNames = NewOrderedMapWithSizeHint<string, GoPtr<CommandLineOption>>(optDecls.length);
  const shortOptionNames: GoMap<string, string> = new globalThis.Map<string, string>();
  for (const option of optDecls) {
    OrderedMap_Set(optionsNames, strings.ToLower(option!.Name), option);
    if (option!.ShortName !== "") {
      shortOptionNames.set(option!.ShortName, option!.Name);
    }
  }
  return {
    optionsNames,
    shortOptionNames,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/namemap.go::type::NameMap","kind":"type","status":"implemented","sigHash":"273d1c8cdf8c433e9b8b3d758094909c22f43fc97ce81e545200d853ef750f7b","bodyHash":"fd40b0c64a322a60d4ed386bb2f8141d4938044e39ae404452bc16b5fdb42a38"}
 *
 * Go source:
 * NameMap struct {
 * 	optionsNames     *collections.OrderedMap[string, *CommandLineOption]
 * 	shortOptionNames map[string]string
 * }
 */
export interface NameMap {
  optionsNames: GoPtr<OrderedMap<string, GoPtr<CommandLineOption>>>;
  shortOptionNames: GoMap<string, string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/namemap.go::method::NameMap.Get","kind":"method","status":"implemented","sigHash":"b8e28a982e3c6df72a39a769977a9d14d4299ecdc2778848cc2df44a59b535f3","bodyHash":"90a7ed38a0e4d0fe40c368d8081af394d84133f9ac929bf3e847dfc86476a678"}
 *
 * Go source:
 * func (nm *NameMap) Get(name string) *CommandLineOption {
 * 	return nm.optionsNames.GetOrZero(strings.ToLower(name))
 * }
 */
export function NameMap_Get(receiver: GoPtr<NameMap>, name: string): GoPtr<CommandLineOption> {
  const nm = receiver!;
  return OrderedMap_GetOrZero(nm.optionsNames, strings.ToLower(name)) as GoPtr<CommandLineOption>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/namemap.go::method::NameMap.GetFromShort","kind":"method","status":"implemented","sigHash":"b9c578457853d0de10d560bef1371726c3ac0c1a06ac902264dffc4629e29319","bodyHash":"e37e5f9f3746400ed35c42be2615cd76821154ad569e546ed97815f18cbc1158"}
 *
 * Go source:
 * func (nm *NameMap) GetFromShort(shortName string) *CommandLineOption {
 * 	// returns option only if shortName is a valid short option
 * 	name, ok := nm.shortOptionNames[shortName]
 * 	if !ok {
 * 		return nil
 * 	}
 * 	return nm.Get(name)
 * }
 */
export function NameMap_GetFromShort(receiver: GoPtr<NameMap>, shortName: string): GoPtr<CommandLineOption> {
  const nm = receiver!;
  // returns option only if shortName is a valid short option
  const ok = nm.shortOptionNames.has(shortName);
  const name = nm.shortOptionNames.get(shortName) ?? "";
  if (!ok) {
    return undefined;
  }
  return NameMap_Get(nm, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/namemap.go::method::NameMap.GetOptionDeclarationFromName","kind":"method","status":"implemented","sigHash":"a227b7fb0c153032e620f27da592fea03c3c8436eca907fb9b843b65a8786a90","bodyHash":"93dcdf4e325073d8dcef198e6edb4d86f7d849841473b714031e084bca606b5a"}
 *
 * Go source:
 * func (nm *NameMap) GetOptionDeclarationFromName(optionName string, allowShort bool) *CommandLineOption {
 * 	optionName = strings.ToLower(optionName)
 * 	// Try to translate short option names to their full equivalents.
 * 	if allowShort {
 * 		short := nm.shortOptionNames[optionName]
 * 		if short != "" {
 * 			optionName = short
 * 		}
 * 	}
 * 	return nm.Get(optionName)
 * }
 */
export function NameMap_GetOptionDeclarationFromName(receiver: GoPtr<NameMap>, optionName: string, allowShort: bool): GoPtr<CommandLineOption> {
  const nm = receiver!;
  const lowered = strings.ToLower(optionName);
  // Try to translate short option names to their full equivalents.
  const resolved = ((): string => {
    if (allowShort) {
      const short = nm.shortOptionNames.get(lowered) ?? "";
      if (short !== "") {
        return short;
      }
    }
    return lowered;
  })();
  return NameMap_Get(nm, resolved);
}

// Assigned here (after OptionsDeclarations, BuildOpts, and OptionsForWatch are
// initialized in their respective modules) to match Go's dependency-ordered
// package-level var initialization.
CompilerNameMap = GetNameMapFromList(OptionsDeclarations);
BuildNameMap = GetNameMapFromList(BuildOpts);
WatchNameMap = GetNameMapFromList(OptionsForWatch);
