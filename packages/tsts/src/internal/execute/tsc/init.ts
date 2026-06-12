import type { GoPtr } from "../../../go/compat.js";
import { Fprint } from "../../../go/fmt.js";
import * as strings from "../../../go/strings.js";
import {
  OrderedMap_Get,
  OrderedMap_GetOrZero,
  OrderedMap_Has,
  OrderedMap_Keys,
} from "../../collections/ordered_map.js";
import type { OrderedMap } from "../../collections/ordered_map.js";
import {
  ModuleDetectionKindForce,
  ModuleKindNodeNext,
  ScriptTargetESNext,
  JsxEmitReactJSX,
} from "../../core/compileroptions.js";
import { Message_Localize } from "../../diagnostics/diagnostics.js";
import {
  A_tsconfig_json_file_is_already_defined_at_Colon_0,
  Visit_https_Colon_Slash_Slashaka_ms_Slashtsconfig_to_read_more_about_this_file,
  File_Layout,
  Environment_Settings,
  See_also_https_Colon_Slash_Slashaka_ms_Slashtsconfig_Slashmodule,
  For_nodejs_Colon,
  X_and_npm_install_D_types_Slashnode,
  Other_Outputs,
  Stricter_Typechecking_Options,
  Style_Options,
  Recommended_Options,
} from "../../diagnostics/generated/messages.js";
import type { Locale } from "../../locale/locale.js";
import {
  CommandLineOption_EnumMap,
  CommandLineOption_Elements,
  CommandLineOptionTypeEnum,
} from "../../tsoptions/commandlineoption.js";
import { OptionsDeclarations } from "../../tsoptions/declscompiler.js";
import {
  CombinePaths,
  NormalizePath,
} from "../../tspath/path.js";
import { NewCompilerDiagnostic } from "../../ast/diagnostic.js";
import type { System } from "./compile.js";
import type { DiagnosticReporter } from "./diagnostics.js";
import { getHeader } from "./help.js";
import {
  OrderedMap_Entries,
} from "../../collections/ordered_map.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/init.go::func::WriteConfigFile","kind":"func","status":"implemented","sigHash":"ededadbb731410ca8ab2ac74c43f9222fa97522188b4b8c08ddb49ca345b0ef2","bodyHash":"12c85bede8a97db069328c67d0778b834dea07db54690522e70a02e2bad68378"}
 *
 * Go source:
 * func WriteConfigFile(sys System, locale locale.Locale, reportDiagnostic DiagnosticReporter, options *collections.OrderedMap[string, any]) {
 * 	getCurrentDirectory := sys.GetCurrentDirectory()
 * 	file := tspath.NormalizePath(tspath.CombinePaths(getCurrentDirectory, "tsconfig.json"))
 * 	if sys.FS().FileExists(file) {
 * 		reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.A_tsconfig_json_file_is_already_defined_at_Colon_0, file))
 * 	} else {
 * 		_ = sys.FS().WriteFile(file, generateTSConfig(options, locale))
 * 		output := []string{"\n"}
 * 		output = append(output, getHeader(sys, "Created a new tsconfig.json")...)
 * 		output = append(output, "You can learn more at https://aka.ms/tsconfig", "\n")
 * 		fmt.Fprint(sys.Writer(), strings.Join(output, ""))
 * 	}
 * }
 */
export function WriteConfigFile(sys: System, locale: Locale, reportDiagnostic: DiagnosticReporter, options: GoPtr<OrderedMap>): void {
  const getCurrentDirectory = sys.GetCurrentDirectory();
  const file = NormalizePath(CombinePaths(getCurrentDirectory, "tsconfig.json"));
  if (sys.FS().FileExists(file)) {
    reportDiagnostic(NewCompilerDiagnostic(A_tsconfig_json_file_is_already_defined_at_Colon_0, file));
  } else {
    sys.FS().WriteFile(file, generateTSConfig(options, locale));
    const output: string[] = ["\n"];
    output.push(...getHeader(sys, "Created a new tsconfig.json"));
    output.push("You can learn more at https://aka.ms/tsconfig", "\n");
    Fprint(sys.Writer(), strings.Join(output, ""));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/init.go::func::generateTSConfig","kind":"func","status":"implemented","sigHash":"a42918323f68a18908487174831abddda142413e3f4d969857a607cbb420a0fd","bodyHash":"1b6a2d11397118cec077eb08e95ef4d564e44736bb7aa6f6f6a250d07f56637d"}
 *
 * Go source:
 * func generateTSConfig(options *collections.OrderedMap[string, any], locale locale.Locale) string {
 * 	const tab = "  "
 * 	var result []string
 *
 * 	allSetOptions := make([]string, 0, options.Size())
 * 	for k := range options.Keys() {
 * 		if k != "init" && k != "help" && k != "watch" {
 * 			allSetOptions = append(allSetOptions, k)
 * 		}
 * 	}
 *
 * 	emitHeader := func(header *diagnostics.Message) {
 * 		result = append(result, tab+tab+"// "+header.Localize(locale))
 * 	}
 * 	newline := func() {
 * 		result = append(result, "")
 * 	}
 * 	push := func(args ...string) {
 * 		result = append(result, args...)
 * 	}
 *
 * 	formatSingleValue := func(value any, enumMap *collections.OrderedMap[string, any]) string {
 * 		if enumMap != nil {
 * 			var found bool
 * 			for k, v := range enumMap.Entries() {
 * 				if value == v {
 * 					value = k
 * 					found = true
 * 					break
 * 				}
 * 			}
 * 			if !found {
 * 				panic(fmt.Sprintf("No matching value of %v", value))
 * 			}
 * 		}
 *
 * 		b, err := json.MarshalIndent(value, "", "")
 * 		if err != nil {
 * 			panic(fmt.Sprintf("should not happen: %v", err))
 * 		}
 * 		return string(b)
 * 	}
 *
 * 	formatValueOrArray := func(settingName string, value any) string {
 * 		var option *tsoptions.CommandLineOption
 * 		for _, decl := range tsoptions.OptionsDeclarations {
 * 			if decl.Name == settingName {
 * 				option = decl
 * 			}
 * 		}
 * 		if option == nil {
 * 			panic(`No option named ` + settingName)
 * 		}
 *
 * 		rval := reflect.ValueOf(value)
 * 		if rval.Kind() == reflect.Slice {
 * 			var enumMap *collections.OrderedMap[string, any]
 * 			if elemOption := option.Elements(); elemOption != nil {
 * 				enumMap = elemOption.EnumMap()
 * 			}
 *
 * 			var elems []string
 * 			for i := range rval.Len() {
 * 				elems = append(elems, formatSingleValue(rval.Index(i).Interface(), enumMap))
 * 			}
 * 			return `[` + strings.Join(elems, ", ") + `]`
 * 		} else {
 * 			return formatSingleValue(value, option.EnumMap())
 * 		}
 * 	}
 *
 * 	// commentedNever': Never comment this out
 * 	// commentedAlways': Always comment this out, even if it's on commandline
 * 	// commentedOptional': Comment out unless it's on commandline
 * 	type commented int
 * 	const (
 * 		commentedNever commented = iota
 * 		commentedAlways
 * 		commentedOptional
 * 	)
 * 	emitOption := func(setting string, defaultValue any, commented commented) {
 * 		if commented > 2 {
 * 			panic("should not happen: invalid `commented`, must be a bug.")
 * 		}
 *
 * 		existingOptionIndex := slices.Index(allSetOptions, setting)
 * 		if existingOptionIndex >= 0 {
 * 			allSetOptions = slices.Delete(allSetOptions, existingOptionIndex, existingOptionIndex+1)
 * 		}
 *
 * 		var comment bool
 * 		switch commented {
 * 		case commentedAlways:
 * 			comment = true
 * 		case commentedNever:
 * 			comment = false
 * 		default:
 * 			comment = !options.Has(setting)
 * 		}
 *
 * 		value, ok := options.Get(setting)
 * 		if !ok {
 * 			value = defaultValue
 * 		}
 *
 * 		if comment {
 * 			push(tab + tab + `// "` + setting + `": ` + formatValueOrArray(setting, value) + `,`)
 * 		} else {
 * 			push(tab + tab + `"` + setting + `": ` + formatValueOrArray(setting, value) + `,`)
 * 		}
 * 	}
 *
 * 	push("{")
 * 	push(tab + `// ` + diagnostics.Visit_https_Colon_Slash_Slashaka_ms_Slashtsconfig_to_read_more_about_this_file.Localize(locale))
 * 	push(tab + `"compilerOptions": {`)
 *
 * 	emitHeader(diagnostics.File_Layout)
 * 	emitOption("rootDir", "./src", commentedOptional)
 * 	emitOption("outDir", "./dist", commentedOptional)
 *
 * 	newline()
 *
 * 	emitHeader(diagnostics.Environment_Settings)
 * 	emitHeader(diagnostics.See_also_https_Colon_Slash_Slashaka_ms_Slashtsconfig_Slashmodule)
 * 	emitOption("module", core.ModuleKindNodeNext, commentedNever)
 * 	emitOption("target", core.ScriptTargetESNext, commentedNever)
 * 	emitOption("types", []any{}, commentedNever)
 * 	if lib, ok := options.Get("lib"); ok {
 * 		emitOption("lib", lib, commentedNever)
 * 	}
 * 	emitHeader(diagnostics.For_nodejs_Colon)
 * 	push(tab + tab + `// "lib": ["esnext"],`)
 * 	push(tab + tab + `// "types": ["node"],`)
 * 	emitHeader(diagnostics.X_and_npm_install_D_types_Slashnode)
 *
 * 	newline()
 *
 * 	emitHeader(diagnostics.Other_Outputs)
 * 	emitOption("sourceMap", true, commentedNever)
 * 	emitOption("declaration", true, commentedNever)
 * 	emitOption("declarationMap", true, commentedNever)
 *
 * 	newline()
 *
 * 	emitHeader(diagnostics.Stricter_Typechecking_Options)
 * 	emitOption("noUncheckedIndexedAccess", true, commentedNever)
 * 	emitOption("exactOptionalPropertyTypes", true, commentedNever)
 *
 * 	newline()
 *
 * 	emitHeader(diagnostics.Style_Options)
 * 	emitOption("noImplicitReturns", true, commentedOptional)
 * 	emitOption("noImplicitOverride", true, commentedOptional)
 * 	emitOption("noUnusedLocals", true, commentedOptional)
 * 	emitOption("noUnusedParameters", true, commentedOptional)
 * 	emitOption("noFallthroughCasesInSwitch", true, commentedOptional)
 * 	emitOption("noPropertyAccessFromIndexSignature", true, commentedOptional)
 *
 * 	newline()
 *
 * 	emitHeader(diagnostics.Recommended_Options)
 * 	emitOption("strict", true, commentedNever)
 * 	emitOption("jsx", core.JsxEmitReactJSX, commentedNever)
 * 	emitOption("verbatimModuleSyntax", true, commentedNever)
 * 	emitOption("isolatedModules", true, commentedNever)
 * 	emitOption("noUncheckedSideEffectImports", true, commentedNever)
 * 	emitOption("moduleDetection", core.ModuleDetectionKindForce, commentedNever)
 * 	emitOption("skipLibCheck", true, commentedNever)
 *
 * 	// Write any user-provided options we haven't already
 * 	if len(allSetOptions) > 0 {
 * 		newline()
 * 		for len(allSetOptions) > 0 {
 * 			emitOption(allSetOptions[0], options.GetOrZero(allSetOptions[0]), commentedNever)
 * 		}
 * 	}
 *
 * 	push(tab + "}")
 * 	push(`}`)
 * 	push(``)
 *
 * 	return strings.Join(result, "\n")
 * }
 */
export function generateTSConfig(options: GoPtr<OrderedMap>, locale: Locale): string {
  const tab = "  ";
  const result: string[] = [];

  const allSetOptions: string[] = [];
  OrderedMap_Keys(options)((k: unknown): boolean => {
    if (k !== "init" && k !== "help" && k !== "watch") {
      allSetOptions.push(k as string);
    }
    return true;
  });

  const emitHeader = (header: GoPtr<import("../../diagnostics/diagnostics.js").Message>): void => {
    result.push(tab + tab + "// " + Message_Localize(header, locale));
  };
  const newline = (): void => {
    result.push("");
  };
  const push = (...args: string[]): void => {
    result.push(...args);
  };

  const formatSingleValue = (value: unknown, enumMap: GoPtr<OrderedMap>): string => {
    let resolvedValue = value;
    if (enumMap !== undefined) {
      let found = false;
      OrderedMap_Entries(enumMap)((k: unknown, v: unknown): boolean => {
        if (v === resolvedValue) {
          resolvedValue = k;
          found = true;
          return false; // break
        }
        return true;
      });
      if (!found) {
        throw new globalThis.Error(`No matching value of ${resolvedValue}`);
      }
    }

    return globalThis.JSON.stringify(resolvedValue);
  };

  const formatValueOrArray = (settingName: string, value: unknown): string => {
    let option: GoPtr<import("../../tsoptions/commandlineoption.js").CommandLineOption> = undefined;
    for (const decl of OptionsDeclarations) {
      if (decl!.Name === settingName) {
        option = decl;
      }
    }
    if (option === undefined) {
      throw new globalThis.Error(`No option named ` + settingName);
    }

    if (globalThis.Array.isArray(value)) {
      let enumMap: GoPtr<OrderedMap> = undefined;
      const elemOption = CommandLineOption_Elements(option);
      if (elemOption !== undefined) {
        enumMap = CommandLineOption_EnumMap(elemOption);
      }

      const elems: string[] = [];
      for (const item of value) {
        elems.push(formatSingleValue(item, enumMap));
      }
      return `[` + strings.Join(elems, ", ") + `]`;
    } else {
      return formatSingleValue(value, CommandLineOption_EnumMap(option));
    }
  };

  // commentedNever: Never comment this out
  // commentedAlways: Always comment this out, even if it's on commandline
  // commentedOptional: Comment out unless it's on commandline
  const commentedNever = 0;
  const commentedAlways = 1;
  const commentedOptional = 2;

  const emitOption = (setting: string, defaultValue: unknown, commented: number): void => {
    if (commented > 2) {
      throw new globalThis.Error("should not happen: invalid `commented`, must be a bug.");
    }

    const existingOptionIndex = allSetOptions.indexOf(setting);
    if (existingOptionIndex >= 0) {
      allSetOptions.splice(existingOptionIndex, 1);
    }

    let comment: boolean;
    switch (commented) {
      case commentedAlways:
        comment = true;
        break;
      case commentedNever:
        comment = false;
        break;
      default:
        comment = !OrderedMap_Has(options, setting);
        break;
    }

    const [optValue, ok] = OrderedMap_Get(options, setting);
    const value = ok ? optValue : defaultValue;

    if (comment) {
      push(tab + tab + `// "` + setting + `": ` + formatValueOrArray(setting, value) + `,`);
    } else {
      push(tab + tab + `"` + setting + `": ` + formatValueOrArray(setting, value) + `,`);
    }
  };

  push("{");
  push(tab + `// ` + Message_Localize(Visit_https_Colon_Slash_Slashaka_ms_Slashtsconfig_to_read_more_about_this_file, locale));
  push(tab + `"compilerOptions": {`);

  emitHeader(File_Layout);
  emitOption("rootDir", "./src", commentedOptional);
  emitOption("outDir", "./dist", commentedOptional);

  newline();

  emitHeader(Environment_Settings);
  emitHeader(See_also_https_Colon_Slash_Slashaka_ms_Slashtsconfig_Slashmodule);
  emitOption("module", ModuleKindNodeNext, commentedNever);
  emitOption("target", ScriptTargetESNext, commentedNever);
  emitOption("types", [], commentedNever);
  const [lib, libOk] = OrderedMap_Get(options, "lib");
  if (libOk) {
    emitOption("lib", lib, commentedNever);
  }
  emitHeader(For_nodejs_Colon);
  push(tab + tab + `// "lib": ["esnext"],`);
  push(tab + tab + `// "types": ["node"],`);
  emitHeader(X_and_npm_install_D_types_Slashnode);

  newline();

  emitHeader(Other_Outputs);
  emitOption("sourceMap", true, commentedNever);
  emitOption("declaration", true, commentedNever);
  emitOption("declarationMap", true, commentedNever);

  newline();

  emitHeader(Stricter_Typechecking_Options);
  emitOption("noUncheckedIndexedAccess", true, commentedNever);
  emitOption("exactOptionalPropertyTypes", true, commentedNever);

  newline();

  emitHeader(Style_Options);
  emitOption("noImplicitReturns", true, commentedOptional);
  emitOption("noImplicitOverride", true, commentedOptional);
  emitOption("noUnusedLocals", true, commentedOptional);
  emitOption("noUnusedParameters", true, commentedOptional);
  emitOption("noFallthroughCasesInSwitch", true, commentedOptional);
  emitOption("noPropertyAccessFromIndexSignature", true, commentedOptional);

  newline();

  emitHeader(Recommended_Options);
  emitOption("strict", true, commentedNever);
  emitOption("jsx", JsxEmitReactJSX, commentedNever);
  emitOption("verbatimModuleSyntax", true, commentedNever);
  emitOption("isolatedModules", true, commentedNever);
  emitOption("noUncheckedSideEffectImports", true, commentedNever);
  emitOption("moduleDetection", ModuleDetectionKindForce, commentedNever);
  emitOption("skipLibCheck", true, commentedNever);

  // Write any user-provided options we haven't already
  if (allSetOptions.length > 0) {
    newline();
    while (allSetOptions.length > 0) {
      const firstOpt = allSetOptions[0]!;
      emitOption(firstOpt, OrderedMap_GetOrZero(options, firstOpt), commentedNever);
    }
  }

  push(tab + "}");
  push(`}`);
  push(``);

  return strings.Join(result, "\n");
}
