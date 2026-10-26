import { assert } from "chai";
import {
  MAX_BATCH_INSTALL_COUNT,
  canShowBatchInstall,
} from "../src/ui/table/TableMenuHandler";

describe("table menu handler", function () {
  it("shows batch install for at most ten selected add-ons", function () {
    assert.isTrue(canShowBatchInstall(1));
    assert.isTrue(canShowBatchInstall(MAX_BATCH_INSTALL_COUNT));
    assert.isFalse(canShowBatchInstall(MAX_BATCH_INSTALL_COUNT + 1));
  });
});
