import type { GoPtr, GoSlice } from "../../go/compat.js";
import {
  PollingKindPriorityInterval,
  WatchDirectoryKindUseFsEvents,
  WatchFileKindUseFsEvents,
} from "../core/watchoptions.js";
import * as diagnostics from "../diagnostics/generated/messages.js";
import type { CommandLineOption } from "./commandlineoption.js";
import {
  CommandLineOptionTypeBoolean,
  CommandLineOptionTypeEnum,
  CommandLineOptionTypeList,
  CommandLineOptionTypeNumber,
  extraValidationNone,
  newCommandLineOption,
} from "./commandlineoption.js";


/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declswatch.go::varGroup::OptionsForWatch","kind":"varGroup","status":"implemented","sigHash":"5625736dc14613db66c37f61011e7bbf33c0df050850b85f2e36a529495bada2","bodyHash":"452ed669ba29d24cebb4c9055e77dd177f08b3995f05a7fa36298124dbe019d9"}
 *
 * Go source:
 * var OptionsForWatch = []*CommandLineOption{
 * 	{
 * 		Name:     "watchInterval",
 * 		Kind:     CommandLineOptionTypeNumber,
 * 		Category: diagnostics.Watch_and_Build_Modes,
 * 	},
 * 	{
 * 		Name: "watchFile",
 * 		Kind: CommandLineOptionTypeEnum,
 * 		// new Map(Object.entries({
 * 		//     fixedpollinginterval: WatchFileKind.FixedPollingInterval,
 * 		//     prioritypollinginterval: WatchFileKind.PriorityPollingInterval,
 * 		//     dynamicprioritypolling: WatchFileKind.DynamicPriorityPolling,
 * 		//     fixedchunksizepolling: WatchFileKind.FixedChunkSizePolling,
 * 		//     usefsevents: WatchFileKind.UseFsEvents,
 * 		//     usefseventsonparentdirectory: WatchFileKind.UseFsEventsOnParentDirectory,
 * 		// })),
 * 		Category:                diagnostics.Watch_and_Build_Modes,
 * 		Description:             diagnostics.Specify_how_the_TypeScript_watch_mode_works,
 * 		DefaultValueDescription: core.WatchFileKindUseFsEvents,
 * 	},
 * 	{
 * 		Name: "watchDirectory",
 * 		Kind: CommandLineOptionTypeEnum,
 * 		// new Map(Object.entries({
 * 		//     usefsevents: WatchDirectoryKind.UseFsEvents,
 * 		//     fixedpollinginterval: WatchDirectoryKind.FixedPollingInterval,
 * 		//     dynamicprioritypolling: WatchDirectoryKind.DynamicPriorityPolling,
 * 		//     fixedchunksizepolling: WatchDirectoryKind.FixedChunkSizePolling,
 * 		// })),
 * 		Category:                diagnostics.Watch_and_Build_Modes,
 * 		Description:             diagnostics.Specify_how_directories_are_watched_on_systems_that_lack_recursive_file_watching_functionality,
 * 		DefaultValueDescription: core.WatchDirectoryKindUseFsEvents,
 * 	},
 * 	{
 * 		Name: "fallbackPolling",
 * 		Kind: CommandLineOptionTypeEnum,
 * 		// new Map(Object.entries({
 * 		//     fixedinterval: PollingWatchKind.FixedInterval,
 * 		//     priorityinterval: PollingWatchKind.PriorityInterval,
 * 		//     dynamicpriority: PollingWatchKind.DynamicPriority,
 * 		//     fixedchunksize: PollingWatchKind.FixedChunkSize,
 * 		// })),
 * 		Category:                diagnostics.Watch_and_Build_Modes,
 * 		Description:             diagnostics.Specify_what_approach_the_watcher_should_use_if_the_system_runs_out_of_native_file_watchers,
 * 		DefaultValueDescription: core.PollingKindPriorityInterval,
 * 	},
 * 	{
 * 		Name:                    "synchronousWatchDirectory",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Watch_and_Build_Modes,
 * 		Description:             diagnostics.Synchronously_call_callbacks_and_update_the_state_of_directory_watchers_on_platforms_that_don_t_support_recursive_watching_natively,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name: "excludeDirectories",
 * 		Kind: CommandLineOptionTypeList,
 * 		// element: {
 * 		//     Name: "excludeDirectory",
 * 		//     Kind: "string",
 * 		//     isFilePath: true,
 * 		//     extraValidation: specToDiagnostic,
 * 		// },
 * 		allowConfigDirTemplateSubstitution: true,
 * 		Category:                           diagnostics.Watch_and_Build_Modes,
 * 		Description:                        diagnostics.Remove_a_list_of_directories_from_the_watch_process,
 * 	},
 * 	{
 * 		Name: "excludeFiles",
 * 		Kind: CommandLineOptionTypeList,
 * 		// element: {
 * 		//     Name: "excludeFile",
 * 		//     Kind: "string",
 * 		//     isFilePath: true,
 * 		//     extraValidation: specToDiagnostic,
 * 		// },
 * 		allowConfigDirTemplateSubstitution: true,
 * 		Category:                           diagnostics.Watch_and_Build_Modes,
 * 		Description:                        diagnostics.Remove_a_list_of_files_from_the_watch_mode_s_processing,
 * 	},
 * }
 */
export const OptionsForWatch: GoSlice<GoPtr<CommandLineOption>> = [
  newCommandLineOption({
    Name: "watchInterval",
    Kind: CommandLineOptionTypeNumber,
    Category: diagnostics.Watch_and_Build_Modes,
  }),
  newCommandLineOption({
    Name: "watchFile",
    Kind: CommandLineOptionTypeEnum,
    // new Map(Object.entries({
    //     fixedpollinginterval: WatchFileKind.FixedPollingInterval,
    //     prioritypollinginterval: WatchFileKind.PriorityPollingInterval,
    //     dynamicprioritypolling: WatchFileKind.DynamicPriorityPolling,
    //     fixedchunksizepolling: WatchFileKind.FixedChunkSizePolling,
    //     usefsevents: WatchFileKind.UseFsEvents,
    //     usefseventsonparentdirectory: WatchFileKind.UseFsEventsOnParentDirectory,
    // })),
    Category: diagnostics.Watch_and_Build_Modes,
    Description: diagnostics.Specify_how_the_TypeScript_watch_mode_works,
    DefaultValueDescription: WatchFileKindUseFsEvents,
  }),
  newCommandLineOption({
    Name: "watchDirectory",
    Kind: CommandLineOptionTypeEnum,
    // new Map(Object.entries({
    //     usefsevents: WatchDirectoryKind.UseFsEvents,
    //     fixedpollinginterval: WatchDirectoryKind.FixedPollingInterval,
    //     dynamicprioritypolling: WatchDirectoryKind.DynamicPriorityPolling,
    //     fixedchunksizepolling: WatchDirectoryKind.FixedChunkSizePolling,
    // })),
    Category: diagnostics.Watch_and_Build_Modes,
    Description: diagnostics.Specify_how_directories_are_watched_on_systems_that_lack_recursive_file_watching_functionality,
    DefaultValueDescription: WatchDirectoryKindUseFsEvents,
  }),
  newCommandLineOption({
    Name: "fallbackPolling",
    Kind: CommandLineOptionTypeEnum,
    // new Map(Object.entries({
    //     fixedinterval: PollingWatchKind.FixedInterval,
    //     priorityinterval: PollingWatchKind.PriorityInterval,
    //     dynamicpriority: PollingWatchKind.DynamicPriority,
    //     fixedchunksize: PollingWatchKind.FixedChunkSize,
    // })),
    Category: diagnostics.Watch_and_Build_Modes,
    Description: diagnostics.Specify_what_approach_the_watcher_should_use_if_the_system_runs_out_of_native_file_watchers,
    DefaultValueDescription: PollingKindPriorityInterval,
  }),
  newCommandLineOption({
    Name: "synchronousWatchDirectory",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Watch_and_Build_Modes,
    Description: diagnostics.Synchronously_call_callbacks_and_update_the_state_of_directory_watchers_on_platforms_that_don_t_support_recursive_watching_natively,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "excludeDirectories",
    Kind: CommandLineOptionTypeList,
    // element: {
    //     Name: "excludeDirectory",
    //     Kind: "string",
    //     isFilePath: true,
    //     extraValidation: specToDiagnostic,
    // },
    allowConfigDirTemplateSubstitution: true,
    Category: diagnostics.Watch_and_Build_Modes,
    Description: diagnostics.Remove_a_list_of_directories_from_the_watch_process,
  }),
  newCommandLineOption({
    Name: "excludeFiles",
    Kind: CommandLineOptionTypeList,
    // element: {
    //     Name: "excludeFile",
    //     Kind: "string",
    //     isFilePath: true,
    //     extraValidation: specToDiagnostic,
    // },
    allowConfigDirTemplateSubstitution: true,
    Category: diagnostics.Watch_and_Build_Modes,
    Description: diagnostics.Remove_a_list_of_files_from_the_watch_mode_s_processing,
  }),
];
