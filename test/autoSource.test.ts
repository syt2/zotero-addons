import { assert } from "chai";
import { sortByLatency } from "../src/utils/sourceLatency";

describe("automatic source selection", function () {
  it("orders successful probes by latency", function () {
    const candidates = [
      { id: "github", latency: 200 },
      { id: "jsdelivr", latency: 5 },
      { id: "gh-proxy", latency: 100 },
    ];

    const sorted = sortByLatency(candidates);

    assert.deepEqual(
      sorted.map(({ id }) => id),
      ["jsdelivr", "gh-proxy", "github"],
    );
    assert.deepEqual(
      candidates.map(({ id }) => id),
      ["github", "jsdelivr", "gh-proxy"],
      "sorting must not mutate the probe results",
    );
  });
});
