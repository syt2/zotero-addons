import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setImmediate } from "node:timers";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const sources = new Map(
  [
    "modules/xpiDropInstaller.ts",
    "utils/droppedFiles.ts",
    "services/LocalAddonInstallService.ts",
  ].map((name) => {
    const path = resolve(sourceRoot, name);
    return [
      path,
      ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ];
  }),
);

function setup(choice = 1, installOptions = {}, options = {}) {
  const listeners = new Map();
  const installed = [];
  const alerts = [];
  let prompts = 0;
  const win = {
    addEventListener(type, listener, capture) {
      assert.equal(capture, true);
      assert.equal(listeners.has(type), false);
      listeners.set(type, listener);
    },
    removeEventListener(type, listener, capture) {
      assert.equal(capture, true);
      assert.equal(listeners.get(type), listener);
      listeners.delete(type);
    },
  };
  const cancelled = [];
  const notifications = [];
  const manager = {
    getInstallForFile:
      options.getInstallForFile ??
      (async (file) => ({
        addon: { appDisabled: false },
        error: 0,
        install: async () => {
          installed.push(file.path);
        },
        cancel() {
          cancelled.push(file.path);
        },
        ...installOptions,
      })),
  };
  const globals = {
    Zotero: {
      File: {
        pathToFile: (path) => ({
          path,
          isFile: () => options.isFile !== false,
        }),
      },
    },
    Services: {
      prompt: {
        BUTTON_POS_0: 1,
        BUTTON_POS_1: 256,
        BUTTON_TITLE_IS_STRING: 127,
        BUTTON_TITLE_CANCEL: 2,
        confirmEx() {
          prompts++;
          if (choice instanceof Error) throw choice;
          return typeof choice === "function" ? choice() : choice;
        },
        alert: (...args) => {
          if (options.alertFails) throw new Error("alert failed");
          alerts.push(args);
        },
      },
    },
    ztoolkit: {
      log() {},
      ProgressWindow: class {
        createLine(line) {
          notifications.push(line);
          return this;
        }
        show() {
          if (options.notificationFails) throw new Error("notification failed");
          return this;
        }
      },
    },
  };
  const cache = new Map([
    [resolve(sourceRoot, "utils/locale.ts"), { getString: (key) => key }],
    [
      resolve(sourceRoot, "utils/compat.ts"),
      { getAddonManager: () => manager },
    ],
  ]);
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    assert.ok(sources.has(path), `Unexpected module: ${path}`);
    const exports = {};
    cache.set(path, exports);
    vm.runInNewContext(
      sources.get(path),
      {
        ...globals,
        exports,
        require: (name) => load(resolve(dirname(path), name + ".ts")),
      },
      { filename: path },
    );
    return exports;
  }
  const exports = load(resolve(sourceRoot, "modules/xpiDropInstaller.ts"));
  exports.registerXPIDropInstaller(win);
  return {
    exports,
    win,
    listeners,
    installed,
    alerts,
    cancelled,
    notifications,
    get prompts() {
      return prompts;
    },
  };
}

function transfer(paths, native = true) {
  return {
    types: native ? ["application/x-moz-file", "Files"] : ["Files"],
    mozItemCount: paths.length,
    mozGetDataAt: (_, index) => ({ path: paths[index] }),
    files: paths.map((mozFullPath) => ({ mozFullPath })),
  };
}

function drop(state, dataTransfer) {
  const event = {
    dataTransfer,
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopImmediatePropagation() {
      this.stopped = true;
    },
  };
  state.listeners.get("drop")(event);
  return event;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("Cancel preserves the original drop and never installs", async () => {
  const state = setup();
  const data = transfer(["/tmp/addon.xpi"]);
  const event = drop(state, data);
  await settle();
  assert.equal(state.prompts, 1);
  assert.equal(event.dataTransfer, data);
  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
  assert.deepEqual(state.installed, []);
});

test("Confirm consumes the drop and installs each unique XPI", async () => {
  const state = setup(0);
  const data = transfer(["/tmp/a.XPI", "/tmp/b.xpi", "/tmp/a.XPI"]);
  data.dropEffect = "move";
  const event = drop(state, data);
  assert.equal(data.dropEffect, "copy");
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  await settle();
  assert.deepEqual(state.installed, ["/tmp/a.XPI", "/tmp/b.xpi"]);
});

test("Mixed files, ordinary files and internal Zotero drags pass through", () => {
  const state = setup(0);
  for (const paths of [
    ["/tmp/a.xpi", "/tmp/paper.pdf"],
    ["/tmp/paper.pdf"],
    [],
  ]) {
    assert.equal(drop(state, transfer(paths)).stopped, false);
  }
  const internal = transfer(["/tmp/a.xpi"]);
  internal.types.push("zotero/item");
  assert.equal(drop(state, internal).stopped, false);
  assert.equal(state.prompts, 0);
});

test("DOM files work when native access is unavailable", async () => {
  const state = setup(0);
  const data = transfer(["/tmp/a.xpi"]);
  data.mozGetDataAt = () => {
    throw new Error("unavailable");
  };
  drop(state, data);
  await settle();
  assert.deepEqual(state.installed, ["/tmp/a.xpi"]);
});

test("An unreadable native item does not consume a partial file list", () => {
  const state = setup(0);
  const data = transfer(["/tmp/a.xpi", "/tmp/b.pdf"]);
  data.mozGetDataAt = (_, index) => (index ? null : { path: "/tmp/a.xpi" });
  assert.equal(drop(state, data).stopped, false);
  assert.equal(state.prompts, 0);
});

test("A failed confirmation falls through", () => {
  const state = setup(new Error("dialog failed"));
  assert.equal(drop(state, transfer(["/tmp/a.xpi"])).prevented, false);
});

test("Invalid or incompatible packages produce an error without installing", async () => {
  for (const options of [
    { error: -1, addon: null },
    { addon: { appDisabled: true } },
    {
      install: async () => {
        throw new Error("failed");
      },
    },
  ]) {
    const state = setup(0, options);
    assert.equal(drop(state, transfer(["/tmp/a.xpi"])).stopped, true);
    await settle();
    assert.equal(state.alerts.length, 1);
    assert.deepEqual(state.installed, []);
  }
});

test("Registration is idempotent and unload/shutdown removes listeners", () => {
  const state = setup();
  state.exports.registerXPIDropInstaller(state.win);
  state.exports.unregisterXPIDropInstaller(state.win);
  assert.equal(state.listeners.size, 0);
  state.exports.registerXPIDropInstaller(state.win);
  state.exports.unregisterAllXPIDropInstallers();
  assert.equal(state.listeners.size, 0);
});

test("Dragover preserves copy/move/link and leaves other files untouched", () => {
  const state = setup();
  for (const effect of ["copy", "move", "link"]) {
    const data = transfer(["/tmp/a.xpi"]);
    data.dropEffect = effect;
    const event = {
      dataTransfer: data,
      preventDefault() {
        this.prevented = true;
      },
    };
    state.listeners.get("dragover")(event);
    assert.equal(event.prevented, true);
    assert.equal(data.dropEffect, effect);
    assert.equal(drop(state, data).stopped, false);
    assert.equal(data.dropEffect, effect);
  }
  const ordinary = {
    dataTransfer: transfer(["/tmp/a.pdf"]),
    preventDefault() {
      assert.fail("Ordinary drag changed");
    },
  };
  state.listeners.get("dragover")(ordinary);
});

test("Unavailable file lists and partial DOM fallbacks pass through", () => {
  const state = setup(0);
  const incomplete = transfer(["/tmp/a.xpi", "/tmp/b.pdf"]);
  incomplete.mozGetDataAt = () => {
    throw new Error("unavailable");
  };
  incomplete.files.pop();
  const unreadable = {
    get types() {
      throw new Error("protected");
    },
  };
  const noPaths = transfer(["/tmp/a.xpi"], false);
  noPaths.files = [{ name: "a.xpi" }];
  for (const data of [
    null,
    incomplete,
    unreadable,
    noPaths,
    { types: ["text/uri-list"] },
  ]) {
    assert.equal(drop(state, data).stopped, false);
  }
  assert.equal(state.prompts, 0);
});

test("Directories named .xpi are not installed", async () => {
  const state = setup(0, {}, { isFile: false });
  drop(state, transfer(["/tmp/directory.xpi"]));
  await settle();
  assert.equal(state.alerts.length, 1);
  assert.deepEqual(state.installed, []);
});

test("Shutdown during manifest loading cancels the prepared install", async () => {
  let completeRead;
  const prepared = new Promise((resolve) => {
    completeRead = resolve;
  });
  const state = setup(0, {}, { getInstallForFile: () => prepared });
  let cancelled = 0;
  drop(state, transfer(["/tmp/a.xpi", "/tmp/b.xpi"]));
  state.exports.unregisterAllXPIDropInstallers();
  completeRead({
    addon: {},
    error: 0,
    cancel() {
      cancelled++;
    },
    install() {
      assert.fail("Installed after shutdown");
    },
  });
  await settle();
  assert.equal(cancelled, 1);
  assert.equal(state.notifications.length, 0);
  assert.equal(state.alerts.length, 0);
});

test("Closing the window during installation suppresses UI and later packages", async () => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  let started = 0;
  const state = setup(0, {
    install: () => {
      started++;
      return pending;
    },
  });
  drop(state, transfer(["/tmp/a.xpi", "/tmp/b.xpi"]));
  await settle();
  state.win.closed = true;
  finish();
  await settle();
  assert.equal(started, 1);
  assert.equal(state.notifications.length, 0);
});

test("Unload during the modal confirmation prevents installation", async () => {
  const state = setup(() => {
    state.exports.unregisterXPIDropInstaller(state.win);
    return 0;
  });
  drop(state, transfer(["/tmp/a.xpi"]));
  await settle();
  assert.deepEqual(state.installed, []);
});

test("A failed success notification does not report an install failure", async () => {
  const state = setup(0, {}, { notificationFails: true });
  drop(state, transfer(["/tmp/a.xpi", "/tmp/b.xpi"]));
  await settle();
  assert.deepEqual(state.installed, ["/tmp/a.xpi", "/tmp/b.xpi"]);
  assert.deepEqual(state.alerts, []);
});

test("Failed error notifications do not reject the batch or stop later files", async () => {
  let attempts = 0;
  const state = setup(
    0,
    {
      install: async () => {
        attempts++;
        throw new Error("failed");
      },
    },
    { alertFails: true },
  );
  drop(state, transfer(["/tmp/a.xpi", "/tmp/b.xpi"]));
  await settle();
  assert.equal(attempts, 2);
});

test("Null native data falls back to a complete DOM file list", async () => {
  const state = setup(0);
  const data = transfer(["C:\\Downloads\\a.XPI"]);
  data.mozGetDataAt = () => null;
  drop(state, data);
  await settle();
  assert.deepEqual(state.installed, ["C:\\Downloads\\a.XPI"]);
});

test("A null native install result reports failure", async () => {
  const state = setup(0, {}, { getInstallForFile: async () => null });
  drop(state, transfer(["/tmp/a.xpi"]));
  await settle();
  assert.equal(state.alerts.length, 1);
  assert.equal(state.notifications.length, 0);
});

test("Incompatible prepared installs are cancelled", async () => {
  const state = setup(0, { addon: { appDisabled: true } });
  drop(state, transfer(["/tmp/a.xpi"]));
  await settle();
  assert.deepEqual(state.cancelled, ["/tmp/a.xpi"]);
});
