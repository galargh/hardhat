import { randomUUID } from "node:crypto";
import { cpSync } from "node:fs";
import path from "node:path";
import { before, after } from "node:test";

import { exists, getRealPath, remove } from "@nomicfoundation/hardhat-utils/fs";

/**
 * This helper adds node:test hooks to run the tests inside one of the projects
 * from test/fixture-projects. Assumes you are running from the root of the project.
 *
 * @param projectName The base name of the folder with the project to use.
 * @param changeDirTo If provided, the working directory will be changed to this. Must be a child of the project folder.
 */
export function useFixtureProject(
  projectName: string,
  changeDirTo?: string,
): void {
  let projectPath: string;
  let prevWorkingDir: string;

  before(async () => {
    projectPath = await getFixtureProjectPath(projectName, changeDirTo);
    prevWorkingDir = process.cwd();
    process.chdir(projectPath);
  });

  after(() => {
    process.chdir(prevWorkingDir);
  });
}

/**
 * This helper function is necessary because multiple test files operate on the same fixture project.
 * Since these test files run in parallel, concurrency issues can arise: one test file might attempt
 * to access artifacts while another is deleting them.
 * To prevent this, each test file uses a temporary copy of the fixture project.
 * The temporary folder is named using a randomly generated UUID.
 *
 * @param projectName The base name of the folder with the project to use.
 */
export function useEphemeralFixtureProject(projectName: string): void {
  const basePath = path.join(process.cwd(), "test", "fixture-projects");
  const tmpProjectPath = path.join("tmp", randomUUID());

  before(() => {
    cpSync(
      path.join(basePath, projectName),
      path.join(basePath, tmpProjectPath),
      {
        recursive: true,
        force: true,
      },
    );
  });

  useFixtureProject(tmpProjectPath);

  after(async () => {
    await remove(path.join(basePath, tmpProjectPath));
  });
}

async function getFixtureProjectPath(
  projectName: string,
  changeDirTo?: string,
): Promise<string> {
  const normalizedProjectName = projectName.replaceAll("/", path.sep);

  let projectPath = path.join(
    process.cwd(),
    "test",
    "fixture-projects",
    normalizedProjectName,
  );

  if (changeDirTo !== undefined) {
    projectPath = path.join(projectPath, changeDirTo);
  }

  if (!(await exists(projectPath))) {
    throw new Error(`Fixture project ${projectName} doesn't exist`);
  }

  return getRealPath(projectPath);
}
