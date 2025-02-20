import type { HookContext, NetworkHooks } from "hardhat/types/hooks";
import type { ChainType, NetworkConnection } from "hardhat/types/network";
import type { HardhatPlugin } from "hardhat/types/plugins";

import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import { HardhatError } from "@nomicfoundation/hardhat-errors";
import { assertRejects } from "@nomicfoundation/hardhat-test-utils";
import { assert } from "chai";

import hardhatIgnitionEthersPlugin from "../src/index.js";

describe("ignition helper mutual exclusivity", () => {
  // A fake version of the hardhat-ignition-ethers plugin that adds
  // a fake ignition helper object to the network connection.
  const fakeHardhatIgnitionViemPlugin: HardhatPlugin = {
    id: "test:hardhat-ignition-viem",
    hookHandlers: {
      network: async () => {
        const handlers: Partial<NetworkHooks> = {
          async newConnection<ChainTypeT extends ChainType | string>(
            context: HookContext,
            next: (
              nextContext: HookContext,
            ) => Promise<NetworkConnection<ChainTypeT>>,
          ) {
            const connection: NetworkConnection<ChainTypeT> =
              await next(context);

            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- we are using a fake intentionally for the test
            connection.ignition = {
              type: "test-fake-of-ignition-viem",
            } as any;

            return connection;
          },
        };

        return handlers;
      },
    },
  };

  it("should error when loaded in conjunction with hardhat-ignition-viem", async function () {
    await assertRejects(
      async () => {
        const hre = await createHardhatRuntimeEnvironment({
          plugins: [fakeHardhatIgnitionViemPlugin, hardhatIgnitionEthersPlugin],
        });

        return hre.network.connect();
      },
      (error: Error) => {
        assert.instanceOf(error, HardhatError);
        assert.equal(
          error.number,
          HardhatError.ERRORS.IGNITION
            .ONLY_ONE_IGNITION_EXTENSION_PLUGIN_ALLOWED.number,
        );
        return true;
      },
      "The `hardhat-ethers-plugin` did not detect the presence of the fake `hardhat-ignition-viem-plugin`",
    );
  });
});
