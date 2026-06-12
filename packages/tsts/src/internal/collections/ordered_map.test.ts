import { test } from "node:test";
import assert from "node:assert/strict";
import type { byte, int } from "@tsonic/core/types.js";
import { Collect, IsSorted } from "../../go/slices.js";
import { NewDecoder } from "../../go/github.com/go-json-experiment/json/jsontext.js";
import {
  NewOrderedMapWithSizeHint,
  OrderedMap_as_json_UnmarshalerFrom,
  OrderedMap_Clear,
  OrderedMap_Clone,
  OrderedMap_Delete,
  OrderedMap_Entries,
  OrderedMap_Get,
  OrderedMap_GetOrZero,
  OrderedMap_Has,
  OrderedMap_Keys,
  OrderedMap_Set,
  OrderedMap_Size,
  OrderedMap_UnmarshalJSONFrom,
  OrderedMap_Values,
} from "./ordered_map.js";
import type { OrderedMap } from "./ordered_map.js";

const textEncoder = new TextEncoder();

function padInt(n: number): string {
  return n.toString().padStart(10, " ");
}

function jsonBytes(text: string): byte[] {
  return Array.from(textEncoder.encode(text)) as byte[];
}

function collectEntries<K, V>(map: OrderedMap<K, V>): Array<[K, V]> {
  const entries: Array<[K, V]> = [];
  OrderedMap_Entries(map)((key: K, value: V): boolean => {
    entries.push([key, value]);
    return true;
  });
  return entries;
}

test("OrderedMap mirrors upstream insertion, overwrite, iteration, and deletion", () => {
  const map = NewOrderedMapWithSizeHint<number, string>(0)!;

  assert.equal(OrderedMap_Has(map, 1), false);

  const count = 1_000;
  const start = 1;
  const end = start + count;

  for (let index = start; index < end; index++) {
    OrderedMap_Set(map, index, padInt(index));
  }

  assert.equal(OrderedMap_Size(map), count);

  for (let index = end - 1; index >= start; index--) {
    OrderedMap_Set(map, index, padInt(index));
  }

  assert.equal(OrderedMap_Size(map), count);

  for (let index = start; index < end; index++) {
    const [value, ok] = OrderedMap_Get(map, index);
    assert.equal(ok, true);
    assert.equal(value, padInt(index));
  }

  for (const [key, value] of collectEntries(map)) {
    assert.equal(value, padInt(key));
  }

  const keys = Collect(OrderedMap_Keys(map));
  assert.equal(keys.length, count);
  assert.equal(IsSorted(keys), true);

  const values = Collect(OrderedMap_Values(map));
  assert.equal(values.length, count);
  assert.equal(IsSorted(values), true);

  assert.equal(Collect(OrderedMap_Keys(map))[0], start);
  assert.equal(Collect(OrderedMap_Values(map))[0], padInt(start));
  assert.deepEqual(collectEntries(map)[0], [start, padInt(start)]);

  for (let index = start + 1; index < end; index++) {
    const [deletedValue, deletedOk] = OrderedMap_Delete(map, index);
    assert.equal(deletedOk, true);
    assert.equal(deletedValue, padInt(index));
    assert.equal(OrderedMap_Has(map, index), false);

    const [, getOk] = OrderedMap_Get(map, index);
    assert.equal(getOk, false);

    const [, deleteOk] = OrderedMap_Delete(map, index);
    assert.equal(deleteOk, false);
  }

  assert.equal(OrderedMap_Size(map), 1);
  assert.equal(OrderedMap_Has(map, start), true);

  const [deletedValue, deletedOk] = OrderedMap_Delete(map, start);
  assert.equal(deletedOk, true);
  assert.equal(deletedValue, padInt(start));

  assert.equal(OrderedMap_Size(map), 0);
});

test("OrderedMap.Clone mirrors upstream copy isolation", () => {
  const map = NewOrderedMapWithSizeHint<number, string>(0)!;
  OrderedMap_Set(map, 1, "one");
  OrderedMap_Set(map, 2, "two");

  const clone = OrderedMap_Clone(map)!;

  assert.notEqual(clone, map);
  assert.equal(OrderedMap_Size(clone), 2);
  assert.deepEqual(Collect(OrderedMap_Keys(clone)), [1, 2]);
  assert.deepEqual(Collect(OrderedMap_Values(clone)), ["one", "two"]);

  const [value, ok] = OrderedMap_Get(clone, 1);
  assert.equal(ok, true);
  assert.equal(value, "one");

  OrderedMap_Delete(map, 1);

  assert.equal(OrderedMap_Size(map), 1);
  assert.equal(OrderedMap_Size(clone), 2);
  assert.deepEqual(Collect(OrderedMap_Keys(clone)), [1, 2]);
  assert.deepEqual(Collect(OrderedMap_Values(clone)), ["one", "two"]);
});

test("OrderedMap.Clear mirrors upstream emptying behavior", () => {
  const map = NewOrderedMapWithSizeHint<number, string>(0)!;
  OrderedMap_Set(map, 1, "one");
  OrderedMap_Set(map, 2, "two");

  OrderedMap_Clear(map);

  assert.equal(OrderedMap_Size(map), 0);
  assert.deepEqual(Collect(OrderedMap_Keys(map)), []);
  assert.deepEqual(Collect(OrderedMap_Values(map)), []);
});

test("NewOrderedMapWithSizeHint preserves ordered-map behavior", () => {
  const count = 1_024 as int;
  const map = NewOrderedMapWithSizeHint<number, number>(count)!;

  for (let index = 0; index < count; index++) {
    OrderedMap_Set(map, index, index);
  }

  assert.equal(OrderedMap_Size(map), count);
  assert.deepEqual(Collect(OrderedMap_Keys(map)).slice(0, 4), [0, 1, 2, 3]);
  assert.equal(OrderedMap_GetOrZero(map, 1023), 1023);
});

test("OrderedMap.UnmarshalJSONFrom mirrors upstream object/null/non-object behavior", () => {
  const map = NewOrderedMapWithSizeHint<string, unknown>(0)!;

  let error = OrderedMap_UnmarshalJSONFrom(map, NewDecoder(jsonBytes(`{"a": 1, "b": "two", "c": { "d": 4 } }`)));
  assert.equal(error, undefined);

  assert.equal(OrderedMap_Size(map), 3);
  assert.equal(OrderedMap_GetOrZero(map, "a"), 1);
  assert.deepEqual(Collect(OrderedMap_Keys(map)), ["a", "b", "c"]);

  error = OrderedMap_as_json_UnmarshalerFrom(map).UnmarshalJSONFrom(NewDecoder(jsonBytes(`null`)));
  assert.equal(error, undefined);
  assert.equal(OrderedMap_Size(map), 3);

  error = OrderedMap_UnmarshalJSONFrom(map, NewDecoder(jsonBytes(`"foo"`)));
  assert.match(error?.message ?? "", /cannot unmarshal non-object JSON value into Map/);
});
