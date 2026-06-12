import type { GoPtr, GoSlice } from "../../go/compat.js";
import { Concat } from "../../go/slices.js";
import * as diagnostics from "../diagnostics/generated/messages.js";
import type { CommandLineOption } from "./commandlineoption.js";
import {
  CommandLineOptionTypeNumber,
  extraValidationNone,
  newCommandLineOption,
} from "./commandlineoption.js";
import { commonOptionsWithBuild } from "./declscompiler.js";


/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declsbuild.go::varGroup::TscBuildOption","kind":"varGroup","status":"implemented","sigHash":"a7881acbbdcfcb70d05e16008e560f35eade977ffd0215c8fde3220c1ec7ddca","bodyHash":"6311f138ea27d987e94990472cdb2432a30eb321845d20643db1e3648a73f1b9"}
 *
 * Go source:
 * var TscBuildOption = CommandLineOption{
 * 	Name:                     "build",
 * 	Kind:                     "boolean",
 * 	ShortName:                "b",
 * 	ShowInSimplifiedHelpView: true,
 * 	Category:                 diagnostics.Command_line_Options,
 * 	Description:              diagnostics.Build_one_or_more_projects_and_their_dependencies_if_out_of_date,
 * 	DefaultValueDescription:  false,
 * }
 */
export const TscBuildOption: CommandLineOption = newCommandLineOption({
  Name: "build",
  Kind: "boolean",
  ShortName: "b",
  ShowInSimplifiedHelpView: true,
  Category: diagnostics.Command_line_Options,
  Description: diagnostics.Build_one_or_more_projects_and_their_dependencies_if_out_of_date,
  DefaultValueDescription: false,
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declsbuild.go::varGroup::OptionsForBuild","kind":"varGroup","status":"implemented","sigHash":"b827b0f153dfedb1e94b809019da58e3c535313ef9101cd71f9fc3db03470daa","bodyHash":"3efdcb832279bd04f3253b6fe07612f5a6eba6f546c05425ecf07ce972d321f3"}
 *
 * Go source:
 * var OptionsForBuild = []*CommandLineOption{
 * 	&TscBuildOption,
 * 	{
 * 		Name:                    "verbose",
 * 		ShortName:               "v",
 * 		Category:                diagnostics.Command_line_Options,
 * 		Description:             diagnostics.Enable_verbose_logging,
 * 		Kind:                    "boolean",
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "dry",
 * 		ShortName:               "d",
 * 		Category:                diagnostics.Command_line_Options,
 * 		Description:             diagnostics.Show_what_would_be_built_or_deleted_if_specified_with_clean,
 * 		Kind:                    "boolean",
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "force",
 * 		ShortName:               "f",
 * 		Category:                diagnostics.Command_line_Options,
 * 		Description:             diagnostics.Build_all_projects_including_those_that_appear_to_be_up_to_date,
 * 		Kind:                    "boolean",
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "clean",
 * 		Category:                diagnostics.Command_line_Options,
 * 		Description:             diagnostics.Delete_the_outputs_of_all_projects,
 * 		Kind:                    "boolean",
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "builders",
 * 		Kind:                    CommandLineOptionTypeNumber,
 * 		Category:                diagnostics.Command_line_Options,
 * 		Description:             diagnostics.Set_the_number_of_projects_to_build_concurrently,
 * 		DefaultValueDescription: diagnostics.X_4_unless_singleThreaded_is_passed,
 * 		minValue:                1,
 * 	},
 * 	{
 * 		Name:                    "stopBuildOnErrors",
 * 		Category:                diagnostics.Command_line_Options,
 * 		Description:             diagnostics.Skip_building_downstream_projects_on_error_in_upstream_project,
 * 		Kind:                    "boolean",
 * 		DefaultValueDescription: false,
 * 	},
 * }
 */
export const OptionsForBuild: GoSlice<GoPtr<CommandLineOption>> = [
  TscBuildOption,
  newCommandLineOption({
    Name: "verbose",
    ShortName: "v",
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Enable_verbose_logging,
    Kind: "boolean",
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "dry",
    ShortName: "d",
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Show_what_would_be_built_or_deleted_if_specified_with_clean,
    Kind: "boolean",
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "force",
    ShortName: "f",
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Build_all_projects_including_those_that_appear_to_be_up_to_date,
    Kind: "boolean",
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "clean",
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Delete_the_outputs_of_all_projects,
    Kind: "boolean",
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "builders",
    Kind: CommandLineOptionTypeNumber,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Set_the_number_of_projects_to_build_concurrently,
    DefaultValueDescription: diagnostics.X_4_unless_singleThreaded_is_passed,
    minValue: 1,
  }),
  newCommandLineOption({
    Name: "stopBuildOnErrors",
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Skip_building_downstream_projects_on_error_in_upstream_project,
    Kind: "boolean",
    DefaultValueDescription: false,
  }),
];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declsbuild.go::varGroup::BuildOpts","kind":"varGroup","status":"implemented","sigHash":"538a759bcc8d807f5ae582a703e9cd4ac8c3e62c00f33865de6929274b312c8c","bodyHash":"3dacbf001b6359464d01faaeb230a2d39730988b8c786245754485acab4d924d"}
 *
 * Go source:
 * var BuildOpts = slices.Concat(commonOptionsWithBuild, OptionsForBuild)
 */
export const BuildOpts: GoSlice<GoPtr<CommandLineOption>> = Concat(commonOptionsWithBuild, OptionsForBuild);
