import type { ChainType } from "@ignored/hardhat-vnext/types/config";
import type {
  HookContext,
  NetworkHooks,
} from "@ignored/hardhat-vnext/types/hooks";
import type { NetworkConnection } from "@ignored/hardhat-vnext/types/network";

import { initializeEthers } from "../initialization.js";

export default async (): Promise<Partial<NetworkHooks>> => {
  const handlers: Partial<NetworkHooks> = {
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (
        nextContext: HookContext,
      ) => Promise<NetworkConnection<ChainTypeT>>,
    ) {
      const connection: NetworkConnection<ChainTypeT> = await next(context);

      connection.ethers = await initializeEthers(
        connection.provider,
        connection.networkName,
        connection.networkConfig,
      );

      return connection;
    },
  };

  return handlers;
};
