import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";
import { int } from "@tsonic/core/types.js";

Task.Delay(1 as int).then(() => {});

