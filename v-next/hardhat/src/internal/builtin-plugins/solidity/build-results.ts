import type {
  Artifact as HardhatArtifact,
  ArtifactManager,
} from "../../../types/artifacts.js";
import type {
  CompilationJobCreationError,
  FailedFileBuildResult,
  FileBuildResult,
} from "../../../types/solidity.js";
import type { BuildInfoAndOutput, Artifact as EdrArtifact } from "@ignored/edr";

import {
  assertHardhatInvariant,
  HardhatError,
} from "@ignored/hardhat-vnext-errors";
import { readBinaryFile, readJsonFile } from "@ignored/hardhat-vnext-utils/fs";

import { FileBuildResultType } from "../../../types/solidity.js";

type SolidityBuildResults =
  | Map<string, FileBuildResult>
  | CompilationJobCreationError;
type SuccessfulSolidityBuildResults = Map<
  string,
  Exclude<FileBuildResult, FailedFileBuildResult>
>;

/**
 * This function asserts that the given Solidity build results are successful.
 * It throws a HardhatError if the build results indicate that the compilation
 * job failed.
 */
export function throwIfSolidityBuildFailed(
  results: SolidityBuildResults,
): asserts results is SuccessfulSolidityBuildResults {
  if ("reason" in results) {
    throw new HardhatError(
      HardhatError.ERRORS.SOLIDITY.COMPILATION_JOB_CREATION_ERROR,
      {
        reason: results.formattedReason,
        rootFilePath: results.rootFilePath,
        buildProfile: results.buildProfile,
      },
    );
  }

  const sucessful = [...results.values()].every(
    ({ type }) =>
      type === FileBuildResultType.CACHE_HIT ||
      type === FileBuildResultType.BUILD_SUCCESS,
  );

  if (!sucessful) {
    throw new HardhatError(HardhatError.ERRORS.SOLIDITY.BUILD_FAILED);
  }
}

/**
 * This function returns the build infos and outputs associated with the given
 * Solidity build results.
 *
 * @param results The successful Solidity build results.
 * @param artifactManager The artifact manager.
 * @returns The build infos in the Hardhat v3 format as expected by the EDR.
 */
export async function getBuildInfos(
  results: SuccessfulSolidityBuildResults,
  artifactManager: ArtifactManager,
): Promise<BuildInfoAndOutput[]> {
  let buildIds = await Promise.all(
    Array.from(new Set(results.values())).map(async ({ compilationJob }) =>
      compilationJob.getBuildId(),
    ),
  );
  buildIds = Array.from(new Set(buildIds));

  return Promise.all(
    buildIds.map(async (buildId) => {
      const buildInfoPath = await artifactManager.getBuildInfoPath(buildId);
      const buildInfoOutputPath =
        await artifactManager.getBuildInfoOutputPath(buildId);

      // This is only safe because of how we currently interact with getBuildInfos
      // i.e. we call it immediately after a build which should ensure both
      // the build info and build info output exist. If the usage pattern of this
      // function changes, these invariants might not hold anymore and should be
      // transformed into other errors instead.
      assertHardhatInvariant(
        buildInfoPath !== undefined,
        "buildInfoPath should not be undefined",
      );
      assertHardhatInvariant(
        buildInfoOutputPath !== undefined,
        "buildInfoOutputPath should not be undefined",
      );

      const buildInfo = await readBinaryFile(buildInfoPath);
      const output = await readBinaryFile(buildInfoOutputPath);

      return {
        buildInfo,
        output,
      };
    }),
  );
}

/**
 * This function returns the artifacts generated during the compilation associated
 * with the given Solidity build results. It relies on the fact that each successful
 * build result has a corresponding artifact generated property.
 *
 * @param results The successful Solidity build results.
 * @returns The artifacts in the format expected by the EDR.
 */
export async function getArtifacts(
  results: SuccessfulSolidityBuildResults,
): Promise<EdrArtifact[]> {
  const contractArtifacts = Array.from(results.entries())
    .map(([source, result]) => {
      return result.contractArtifactsGenerated.map((artifactPath) => ({
        source,
        solcVersion: result.compilationJob.solcConfig.version,
        artifactPath,
      }));
    })
    .flat();

  return Promise.all(
    contractArtifacts.map(async ({ source, artifactPath, solcVersion }) => {
      const artifact: HardhatArtifact = await readJsonFile(artifactPath);

      const id = {
        name: artifact.contractName,
        solcVersion,
        source,
      };

      const contract = {
        abi: JSON.stringify(artifact.abi),
        bytecode: artifact.bytecode,
        deployedBytecode: artifact.deployedBytecode,
      };

      return {
        id,
        contract,
      };
    }),
  );
}
