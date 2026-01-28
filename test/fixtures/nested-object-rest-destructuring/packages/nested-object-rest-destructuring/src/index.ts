import { Console } from "@tsonic/dotnet/System.js";

// Nested object rest destructuring must be synthesized correctly.
const {
  name: _name,
  address: { city, ...restAddress },
} = {
  name: "Alice",
  address: { city: "Paris", zip: "123", country: "FR" },
};

// We only assert that the nested rest pattern is synthesized (emitter must not throw).
// Rest object member typing is validated elsewhere.
const ok = city === "Paris";
Console.WriteLine(ok);
