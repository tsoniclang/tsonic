// NEGATIVE TEST: Date is not a global type
// Config Drift Detection: If this test ever passes, it means useStandardLib
// or similar has accidentally leaked Date into the type environment.
//
// The correct pattern is to import System.DateTime:
//   import { DateTime } from "@tsonic/dotnet/System.js";
//   const now: DateTime = DateTime.get_Now();

// ERROR: Cannot find name 'Date'
// Date is not declared in globals
// It must be explicitly imported as System.DateTime
const now: Date = new Date();

export function formatDate(d: Date): string {
  return d.toISOString();
}
