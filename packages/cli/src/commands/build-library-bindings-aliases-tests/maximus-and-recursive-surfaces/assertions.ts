import { expect } from "chai";
import { collectDtsText, readRootBindings } from "./helpers.js";

export const assertMaximusBindings = (bindingsDir: string): void => {
  const rootBindings = readRootBindings(bindingsDir);
  expect(rootBindings.content.producer?.tool).to.equal("tsonic");
  expect(rootBindings.content.producer?.mode).to.equal("tsonic-firstparty");
  expect(Object.keys(rootBindings.content.exports ?? {})).to.include(
    "projectFlags"
  );
  expect(Object.keys(rootBindings.content.exports ?? {})).to.include(
    "createBox"
  );

  const allFacadeText = collectDtsText(bindingsDir);
  for (const alias of expectedTypeAliases) {
    expect(
      allFacadeText,
      `expected generated bindings to contain alias '${alias}'`
    ).to.match(new RegExp(`\\bexport\\s+type\\s+${alias}\\b`));
  }

  for (const value of expectedValueExports) {
    expect(
      allFacadeText,
      `expected generated bindings to contain value export '${value}'`
    ).to.match(new RegExp(`\\b${value}\\b`));
  }
};

const expectedTypeAliases = [
  "UserFlags",
  "UserReadonly",
  "UserPartial",
  "UserRequired",
  "UserPick",
  "UserOmit",
  "Box",
  "BoxReadonly",
  "BoxPartial",
  "BoxRequired",
  "Mutable",
  "Head",
  "Tail",
  "Last",
  "UnwrapPromise",
  "AsyncValue",
  "AwaitedScore",
  "SuccessResult",
  "FailureResult",
  "NonNullName",
  "ExtractStatus",
  "ExcludeStatus",
  "UserAndMeta",
  "PrefixSuffix",
  "UserTuple",
  "UserTupleSpread",
  "EventPayload",
  "ClickPayload",
  "ApiUserRoute",
  "ApiPostRoute",
  "RoutePair",
  "PairJoin",
  "Mapper",
  "MapperParams",
  "MapperResult",
  "SymbolScores",
  "UserRecordCtorArgs",
  "UserRecordInstance",
  "ConstructorArgs",
  "RecordInstance",
];

const expectedValueExports = [
  "id",
  "UserRecord",
  "projectFlags",
  "lookupScore",
  "invokeMapper",
  "createBox",
  "toRoute",
  "projectEvent",
  "createUserTuple",
  "chainScore",
  "loadSideEffects",
  "nextValues",
];
