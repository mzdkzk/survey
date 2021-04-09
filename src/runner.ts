import fs from "fs";
import path from "path";

import ProgressBar from "progress";
import axios from "axios";

import { RepoName, RepoInfo, RepoError } from "./types";
import {
  run,
  sleep,
  parallelPromiseAll,
  safeWriteFileSync,
  outputDir,
  readJson,
} from "./utils";

function dockerRun(command: string): Promise<string> {
  return run(`docker run --rm kazuki-m/runner ${command}`);
}

async function getRepoInfo(repoName: RepoName): Promise<string[][]> {
  const result = await dockerRun(`./getRepoInfo.sh ${repoName}`);
  return result
    .trim()
    .split("\n")
    .map((raw) => raw.split(" "));
}

export type GetRepoInfoResult = RepoInfo | RepoError;

export async function outputRepoInfos(
  repoNames: RepoName[],
  bar: ProgressBar,
  concurrency: number
): Promise<GetRepoInfoResult[]> {
  const tasks = repoNames.map((repoName) => {
    return async () => {
      // repoInfo.jsonが取得済みであれば読み込んで返す
      const filepath = path.join(outputDir, repoName, "repoInfo.json");
      if (fs.existsSync(filepath)) {
        return readJson<RepoInfo | RepoError>(filepath);
      }
      try {
        const results = await getRepoInfo(repoName);
        const repoInfo: RepoInfo = { repoName, versions: {} };
        for (const [name, hash] of results) {
          if (!(name in repoInfo.versions)) {
            repoInfo.versions[name] = hash;
          }
        }
        safeWriteFileSync(filepath, JSON.stringify(repoInfo, null, 2));
        return repoInfo;
      } catch (err) {
        const repoError: RepoError = { repoName, err };
        safeWriteFileSync(filepath, JSON.stringify(repoError, null, 2));
        return repoError;
      }
    };
  });
  return parallelPromiseAll<GetRepoInfoResult>(tasks, bar, concurrency);
}

export async function outputStatuses(
  repoInfo: RepoInfo,
  bar: ProgressBar
): Promise<void> {
  const results: { [version: string]: any } = {};
  for (const [version, hash] of Object.entries(repoInfo.versions)) {
    const response = await axios.get(
      `https://api.github.com/repos/${repoInfo.repoName}/commits/${hash}/status`,
      {
        headers: {
          authorization: `token ${process.env.GH_TOKEN}`,
        },
      }
    );
    results[version] = {
      status: response.status,
      headers: response.headers,
      data: response.data,
    };
    bar.tick();
    await sleep(0.5);
  }
  const filepath = path.join(outputDir, repoInfo.repoName, "repoStatus.json");
  safeWriteFileSync(filepath, JSON.stringify(results, null, 2));
}
