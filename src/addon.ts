import { config } from "../package.json";
import hooks from "./hooks";
import actions from "./modules/registerScheme";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    // Env type, see build.js
    env: "development" | "production";
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: object;

  public actions: typeof actions;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
    this.api = {};
    this.actions = actions;
  }
}

export default Addon;
