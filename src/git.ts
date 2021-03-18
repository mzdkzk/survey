import { run, parallelPromiseAll } from "./utils";

export type Package = {
  version: string;
};

export type Commit = {
  hash: string;
  pkg: Package | null;
};

export async function clone(url: string, dir: string): Promise<void> {
  await run(`git clone ${url} ${dir}`);
}

export async function getHashs(dir: string): Promise<string[]> {
  // pkg_commits.csv内のコミットに置き換え可能？
  const command = `git log --reverse --date-order --pretty="%H"`;
  const gitLogResult = await run(command, dir);
  return gitLogResult.trim().split("\n");
}

export async function getPackage(
  hash: string,
  dir: string
): Promise<Package | null> {
  try {
    const pkg = await run(`git show ${hash}:package.json`, dir);
    return JSON.parse(pkg) as Package;
  } catch (e) {
    return null;
  }
}

export async function getCommits(
  hashs: string[],
  dir: string
): Promise<Commit[]> {
  const tasks = hashs.map((hash) => {
    return async () => {
      const pkg = await getPackage(hash, dir);
      return { hash, pkg };
    };
  });
  return parallelPromiseAll<Commit>(tasks, 10);
}

type RunTestResult = {
  ok: boolean;
  err?: string;
};

export async function runTest(
  hash: string,
  dir: string
): Promise<RunTestResult> {
  try {
    await run(`git reset ${hash} --hard`, dir);
    await run(`npm install && npm run test`, dir);
    return { ok: true };
  } catch (e) {
    return { ok: false, err: `${e.message}` };
  }
}
