import test from "node:test";
import assert from "node:assert/strict";
import { classifyTurn, cleanTranscript } from "./reliability.ts";
test("sequence rejects replay and detects missing or out-of-order turns", () => {
  assert.equal(classifyTurn(0, 1), "accept");
  assert.equal(classifyTurn(1, 1), "duplicate");
  assert.equal(classifyTurn(2, 1), "duplicate");
  assert.equal(classifyTurn(1, 3), "gap");
  assert.equal(classifyTurn(1, undefined), "gap");
  assert.equal(classifyTurn(1, NaN), "gap");
  assert.equal(classifyTurn(1, 2), "accept");
});
test("normalization preserves multilingual text, punctuation and paragraphs", () => {
  assert.equal(cleanTranscript("  Hello,   world!\r\n????.  "), "Hello, world!\n????.");
  assert.equal(cleanTranscript(" "), "");
});
