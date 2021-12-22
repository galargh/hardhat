import path from "path";
import fsExtra from "fs-extra";
import semver from "semver";

import type { Artifacts as ArtifactsImpl } from "hardhat/internal/artifacts";
import type { Artifacts } from "hardhat/types/artifacts";
import { glob } from "hardhat/internal/util/glob";
import { getCompilersDir } from "hardhat/internal/util/global-dir";
import { localPathToSourceName } from "hardhat/utils/source-names";
import { getFullyQualifiedName } from "hardhat/utils/contract-names";
import { TASK_COMPILE_GET_COMPILATION_TASKS } from "hardhat/builtin-tasks/task-names";
import { extendConfig, subtask, types } from "hardhat/config";

import type { VyperOutput, VyperBuild } from "./types";
import {
  TASK_COMPILE_VYPER,
  TASK_COMPILE_VYPER_RUN_BINARY,
  TASK_COMPILE_VYPER_GET_BUILD,
  TASK_COMPILE_VYPER_READ_FILE,
  TASK_COMPILE_VYPER_GET_SOURCE_NAMES,
  TASK_COMPILE_VYPER_GET_SOURCE_PATHS,
  TASK_COMPILE_VYPER_LOG_DOWNLOAD_COMPILER_START,
  TASK_COMPILE_VYPER_LOG_DOWNLOAD_COMPILER_END,
  TASK_COMPILE_VYPER_LOG_COMPILATION_RESULT,
} from "./task-names";
import { DEFAULT_VYPER_VERSION } from "./constants";
import { VyperFilesCache, getVyperFilesCachePath } from "./cache";
import { Compiler } from "./compiler";
import { CompilerDownloader } from "./downloader";
import { Parser } from "./parser";
import { ResolvedFile, Resolver } from "./resolver";
import {
  assertPluginInvariant,
  deepCamel,
  getArtifactFromVyperOutput,
  getLogger,
  normalizeVyperConfig,
  VyperPluginError,
} from "./util";
import "./type-extensions";

const log = getLogger("tasks:compile");

extendConfig((config, userConfig) => {
  const userVyperConfig = userConfig.vyper ?? DEFAULT_VYPER_VERSION;

  config.vyper = normalizeVyperConfig(userVyperConfig);
});

subtask(
  TASK_COMPILE_GET_COMPILATION_TASKS,
  async (_, __, runSuper): Promise<string[]> => {
    const otherTasks = await runSuper();
    return [...otherTasks, TASK_COMPILE_VYPER];
  }
);

subtask(
  TASK_COMPILE_VYPER_GET_SOURCE_PATHS,
  async (_, { config }): Promise<string[]> => {
    const vyPaths = await glob(path.join(config.paths.sources, "**/*.vy"));
    const vpyPaths = await glob(path.join(config.paths.sources, "**/*.v.py"));

    return [...vyPaths, ...vpyPaths];
  }
);

subtask(TASK_COMPILE_VYPER_GET_SOURCE_NAMES)
  .addParam("sourcePaths", undefined, undefined, types.any)
  .setAction(
    async (
      { sourcePaths }: { sourcePaths: string[] },
      { config }
    ): Promise<string[]> => {
      const sourceNames = await Promise.all(
        sourcePaths.map((p) => localPathToSourceName(config.paths.root, p))
      );

      return sourceNames;
    }
  );

subtask(TASK_COMPILE_VYPER_READ_FILE)
  .addParam("absolutePath", undefined, undefined, types.string)
  .setAction(
    async ({ absolutePath }: { absolutePath: string }): Promise<string> => {
      const content = await fsExtra.readFile(absolutePath, {
        encoding: "utf8",
      });

      return content;
    }
  );

subtask(TASK_COMPILE_VYPER_GET_BUILD)
  .addParam("quiet", undefined, undefined, types.boolean)
  .addParam("vyperVersion", undefined, undefined, types.string)
  .setAction(
    async (
      { quiet, vyperVersion }: { quiet: boolean; vyperVersion: string },
      { run }
    ): Promise<VyperBuild> => {
      const compilersCache = await getCompilersDir();
      const downloader = new CompilerDownloader(compilersCache);

      await downloader.downloadReleaseList();

      const isCompilerDownloaded = await downloader.isCompilerDownloaded(
        vyperVersion
      );

      const { name } = await downloader.getCompilerAsset(vyperVersion);

      await run(TASK_COMPILE_VYPER_LOG_DOWNLOAD_COMPILER_START, {
        vyperVersion,
        isCompilerDownloaded,
        quiet,
      });

      const compilerPath = await downloader.getOrDownloadCompiler(vyperVersion);

      if (compilerPath === undefined) {
        throw new VyperPluginError("Can't download vyper compiler");
      }

      await run(TASK_COMPILE_VYPER_LOG_DOWNLOAD_COMPILER_END, {
        vyperVersion,
        isCompilerDownloaded,
        quiet,
      });

      return { compilerPath, name, version: vyperVersion };
    }
  );

subtask(TASK_COMPILE_VYPER_LOG_DOWNLOAD_COMPILER_START)
  .addParam("isCompilerDownloaded", undefined, undefined, types.boolean)
  .addParam("quiet", undefined, undefined, types.boolean)
  .addParam("vyperVersion", undefined, undefined, types.string)
  .setAction(
    async ({
      isCompilerDownloaded,
      quiet,
      vyperVersion,
    }: {
      isCompilerDownloaded: boolean;
      quiet: boolean;
      vyperVersion: string;
    }) => {
      if (isCompilerDownloaded || quiet) return;

      console.log(`Downloading compiler ${vyperVersion}`);
    }
  );

subtask(TASK_COMPILE_VYPER_LOG_DOWNLOAD_COMPILER_END)
  .addParam("isCompilerDownloaded", undefined, undefined, types.boolean)
  .addParam("quiet", undefined, undefined, types.boolean)
  .addParam("vyperVersion", undefined, undefined, types.string)
  .setAction(
    async ({}: {
      isCompilerDownloaded: boolean;
      quiet: boolean;
      vyperVersion: string;
    }) => {}
  );

subtask(TASK_COMPILE_VYPER_LOG_COMPILATION_RESULT)
  .addParam("versionGroups", undefined, undefined, types.any)
  .addParam("quiet", undefined, undefined, types.boolean)
  .setAction(
    async ({
      versionGroups,
      quiet,
    }: {
      versionGroups: object;
      quiet: boolean;
    }) => {
      if (quiet || Object.entries(versionGroups).length === 0) return;

      console.log("Vyper compilation finished successfully");
    }
  );

subtask(TASK_COMPILE_VYPER_RUN_BINARY)
  .addParam("inputPaths", undefined, undefined, types.any)
  .addParam("vyperPath", undefined, undefined, types.string)
  .setAction(
    async ({
      inputPaths,
      vyperPath,
    }: {
      inputPaths: string[];
      vyperPath: string;
    }): Promise<VyperOutput> => {
      const { mapValues } = await import("lodash");
      const compiler = new Compiler(vyperPath);

      const { version, ...contracts } = await compiler.compile(inputPaths);

      return {
        version,
        ...mapValues(contracts, deepCamel),
      };
    }
  );

subtask(TASK_COMPILE_VYPER)
  .addParam("quiet", undefined, undefined, types.boolean)
  .setAction(
    async ({ quiet }: { quiet: boolean }, { artifacts, config, run }) => {
      const sourcePaths: string[] = await run(
        TASK_COMPILE_VYPER_GET_SOURCE_PATHS
      );

      const sourceNames: string[] = await run(
        TASK_COMPILE_VYPER_GET_SOURCE_NAMES,
        { sourcePaths }
      );

      const vyperFilesCachePath = getVyperFilesCachePath(config.paths);
      let vyperFilesCache = await VyperFilesCache.readFromFile(
        vyperFilesCachePath
      );

      const parser = new Parser(vyperFilesCache);
      const resolver = new Resolver(
        config.paths.root,
        parser,
        (absolutePath: string) =>
          run(TASK_COMPILE_VYPER_READ_FILE, { absolutePath })
      );

      let resolvedFiles = await Promise.all(
        sourceNames.map(resolver.resolveSourceName)
      );

      vyperFilesCache = await invalidateCacheMissingArtifacts(
        vyperFilesCache,
        artifacts,
        resolvedFiles
      );

      resolvedFiles = resolvedFiles.filter((file) =>
        vyperFilesCache.hasFileChanged(file.absolutePath, file.contentHash, {
          version: file.content.versionPragma,
        })
      );

      const { groupBy } = await import("lodash");

      const configuredVersions = config.vyper.compilers.map(
        ({ version }) => version
      );

      const versionGroups = groupBy(resolvedFiles, (file: ResolvedFile) =>
        semver.maxSatisfying(configuredVersions, file.content.versionPragma)
      );

      for (const [vyperVersion, files] of Object.entries(versionGroups)) {
        const vyperBuild: VyperBuild = await run(TASK_COMPILE_VYPER_GET_BUILD, {
          quiet,
          vyperVersion,
        });

        log(
          `Compiling ${files.length} files for Vyper version ${vyperVersion}`
        );

        const { version, ...contracts }: VyperOutput = await run(
          TASK_COMPILE_VYPER_RUN_BINARY,
          {
            inputPaths: files.map(({ absolutePath }) => absolutePath),
            vyperPath: vyperBuild.compilerPath,
          }
        );

        for (const [sourceName, output] of Object.entries(contracts)) {
          const artifact = getArtifactFromVyperOutput(sourceName, output);
          await artifacts.saveArtifactAndDebugFile(artifact);

          const file = files.find((f) => f.sourceName === sourceName);
          assertPluginInvariant(
            file !== undefined,
            "File should always be found"
          );

          vyperFilesCache.addFile(file.absolutePath, {
            lastModificationDate: file.lastModificationDate.valueOf(),
            contentHash: file.contentHash,
            sourceName: file.sourceName,
            vyperConfig: { version },
            versionPragma: file.content.versionPragma,
            artifacts: [artifact.contractName],
          });
        }
      }

      const allArtifacts = vyperFilesCache.getEntries();

      // We know this is the actual implementation, so we use some
      // non-public methods here.
      const artifactsImpl = artifacts as ArtifactsImpl;
      artifactsImpl.addValidArtifacts(allArtifacts);

      await vyperFilesCache.writeToFile(vyperFilesCachePath);

      await run(TASK_COMPILE_VYPER_LOG_COMPILATION_RESULT, {
        versionGroups,
        quiet,
      });
    }
  );

/**
 * If a file is present in the cache, but some of its artifacts are missing on
 * disk, we remove it from the cache to force it to be recompiled.
 */
async function invalidateCacheMissingArtifacts(
  vyperFilesCache: VyperFilesCache,
  artifacts: Artifacts,
  resolvedFiles: ResolvedFile[]
): Promise<VyperFilesCache> {
  for (const file of resolvedFiles) {
    const cacheEntry = vyperFilesCache.getEntry(file.absolutePath);

    if (cacheEntry === undefined) {
      continue;
    }

    const { artifacts: emittedArtifacts } = cacheEntry;

    for (const emittedArtifact of emittedArtifacts) {
      const artifactExists = await artifacts.artifactExists(
        getFullyQualifiedName(file.sourceName, emittedArtifact)
      );

      if (!artifactExists) {
        log(
          `Invalidate cache for '${file.absolutePath}' because artifact '${emittedArtifact}' doesn't exist`
        );
        vyperFilesCache.removeEntry(file.absolutePath);
        break;
      }
    }
  }

  return vyperFilesCache;
}
