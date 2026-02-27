import { Console } from "@tsonic/dotnet/System.js";
import type { Profile } from "./model.js";

const profile: Profile = { name: "Ada", age: 36 };
Console.WriteLine(profile.name);
Console.WriteLine(profile.age);
