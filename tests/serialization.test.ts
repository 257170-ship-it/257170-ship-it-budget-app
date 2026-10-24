import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJSON } from "../src/domain/serialization";
test("canonical JSON sorts nested keys and preserves arrays, null and zero", () => {
  assert.equal(canonicalJSON({ z: { b: 1, a: 2 }, a: [null, 0] }), canonicalJSON({ a: [null, 0], z: { a: 2, b: 1 } }));
  assert.notEqual(canonicalJSON([null, 0]), canonicalJSON([0, null]));
  assert.notEqual(canonicalJSON({ amount: null }), canonicalJSON({ amount: 0 }));
  assert.equal(canonicalJSON(JSON.parse('{"__proto__":{"x":1},"a":2}')), '{"__proto__":{"x":1},"a":2}');
});
