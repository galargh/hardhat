import type { Artifact, BuildInfo } from "../../../../types/artifacts.js";
import type { CompilationJob } from "../../../../types/solidity/compilation-job.js";
import type {
  CompilerOutput,
  CompilerOutputContract,
} from "../../../../types/solidity/compiler-io.js";
import type {
  SolidityBuildInfo,
  SolidityBuildInfoOutput,
} from "../../../../types/solidity/solidity-artifacts.js";

export function getContractArtifact(
  buildInfoId: string,
  publicSourceName: string,
  inputSourceName: string,
  contractName: string,
  contract: CompilerOutputContract,
): Artifact {
  const evmBytecode = contract.evm?.bytecode;
  let bytecode: string = evmBytecode?.object ?? "";

  if (bytecode.slice(0, 2).toLowerCase() !== "0x") {
    bytecode = `0x${bytecode}`;
  }

  const evmDeployedBytecode = contract.evm?.deployedBytecode;
  let deployedBytecode: string = evmDeployedBytecode?.object ?? "";

  if (deployedBytecode.slice(0, 2).toLowerCase() !== "0x") {
    deployedBytecode = `0x${deployedBytecode}`;
  }

  const linkReferences = evmBytecode?.linkReferences ?? {};
  const deployedLinkReferences = evmDeployedBytecode?.linkReferences ?? {};

  const immutableReferences = evmDeployedBytecode?.immutableReferences ?? {};

  const artifact: Required<Artifact> = {
    _format: "hh3-artifact-1",
    contractName,
    sourceName: publicSourceName,
    abi: contract.abi,
    bytecode,
    deployedBytecode,
    linkReferences,
    deployedLinkReferences,
    immutableReferences,
    inputSourceName,
    buildInfoId,
  };

  return artifact;
}

export function getArtifactsDeclarationFile(artifacts: Artifact[]): string {
  if (artifacts.length === 0) {
    return "";
  }

  const artifactTypes = artifacts.map(
    (artifact) =>
      `export interface ${artifact.contractName}$Type {
  ${Object.entries(artifact)
    .map(([name, value]) => `readonly ${name}: ${JSON.stringify(value)};`)
    .join("\n  ")}
};`,
  );

  return `// This file was autogenerated by Hardhat-viem, do not edit it.
// prettier-ignore
// tslint:disable
// eslint-disable
// biome-ignore format: see above

${artifactTypes.join("\n\n")}

import "@ignored/hardhat-vnext/types/artifacts";
declare module "@ignored/hardhat-vnext/types/artifacts" {
  interface ArtifactMap {
    ${artifacts.map((artifact) => `["${artifact.contractName}"]: ${artifact.contractName}$Type`).join("\n    ")};
    ${artifacts.map((artifact) => `["${artifact.sourceName}:${artifact.contractName}"]: ${artifact.contractName}$Type`).join("\n    ")};
  }
}`;
}

export function getDuplicatedContractNamesDeclarationFile(
  duplicatedContractNames: string[],
): string {
  if (duplicatedContractNames.length === 0) {
    return "";
  }

  return `// This file was autogenerated by Hardhat-viem, do not edit it.
// prettier-ignore
// tslint:disable
// eslint-disable
// biome-ignore format: see above

import "@ignored/hardhat-vnext/types/artifacts";
declare module "@ignored/hardhat-vnext/types/artifacts" {
  interface ArtifactMap {
    ${duplicatedContractNames.map((name) => `["${name}"]: never`).join("\n    ")};
  }
}`;
}

export async function getBuildInfo(
  compilationJob: CompilationJob,
): Promise<SolidityBuildInfo> {
  const publicSourceNameMap = Object.fromEntries(
    [...compilationJob.dependencyGraph.getRoots().entries()].map(
      ([publicSourceName, root]) => [publicSourceName, root.sourceName],
    ),
  );

  const buildInfo: Required<BuildInfo> = {
    _format: "hh3-sol-build-info-1",
    id: await compilationJob.getBuildId(),
    solcVersion: compilationJob.solcConfig.version,
    solcLongVersion: compilationJob.solcLongVersion,
    publicSourceNameMap,
    input: await compilationJob.getSolcInput(),
  };

  return buildInfo;
}

export async function getBuildInfoOutput(
  compilationJob: CompilationJob,
  compilerOutput: CompilerOutput,
): Promise<SolidityBuildInfoOutput> {
  const buildInfoOutput: Required<SolidityBuildInfoOutput> = {
    _format: "hh3-sol-build-info-output-1",
    id: await compilationJob.getBuildId(),
    output: compilerOutput,
  };

  return buildInfoOutput;
}
