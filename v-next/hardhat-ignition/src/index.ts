import type { HardhatPlugin } from "@ignored/hardhat-vnext/types/plugins";

import { emptyTask, task } from "@ignored/hardhat-vnext/config";
import { ArgumentType } from "@ignored/hardhat-vnext/types/arguments";

import { PLUGIN_ID } from "./internal/constants.js";

import "./type-extensions/config.js";

const hardhatIgnitionPlugin: HardhatPlugin = {
  id: PLUGIN_ID,
  npmPackage: "@ignored/hardhat-vnext-ignition",
  hookHandlers: {
    config: import.meta.resolve("./internal/hook-handlers/config.js"),
  },
  tasks: [
    emptyTask("ignition", "Store your keys in a secure way").build(),
    task(["ignition", "deploy"], "Deploy a module to the specified network")
      .addPositionalArgument({
        name: "modulePath",
        type: ArgumentType.STRING,
        description: "The path to the module file to deploy",
      })
      .addOption({
        name: "parameters",
        type: ArgumentType.FILE,
        description:
          "A relative path to a JSON file to use for the module parameters",
        defaultValue: "", // TODO: check this comes through correctly
      })
      .addOption({
        name: "deploymentId",
        type: ArgumentType.STRING,
        description: "Set the id of the deployment",
        defaultValue: "", // TODO: check this comes through correctly
      })
      .addOption({
        name: "defaultSender",
        type: ArgumentType.STRING,
        description: "Set the default sender for the deployment",
        defaultValue: "", // TODO: check this comes through correctly
      })
      .addOption({
        name: "strategy",
        type: ArgumentType.STRING,
        description: "Set the deployment strategy to use",
        defaultValue: "basic",
      })
      .addFlag({
        name: "reset",
        description: "Wipes the existing deployment state before deploying",
      })
      .addFlag({
        name: "verify",
        description: "Verify the deployment on Etherscan",
      })
      .addFlag({
        name: "writeLocalhostDeployment",
        description:
          "Write deployment information to disk when deploying to the in-memory network",
      })
      .setAction(import.meta.resolve("./internal/tasks/deploy.js"))
      .build(),
  ],
};

export default hardhatIgnitionPlugin;
