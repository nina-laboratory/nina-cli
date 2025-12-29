
import simpleGit, { type SimpleGit, type StatusResult } from "simple-git";

export function getGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath);
}

export async function getRepoStatus(repoPath: string): Promise<StatusResult> {
    // console.debug(`getRepoStatus: ${repoPath}`);
    const git = getGit(repoPath);
    return await git.status();
}

export async function getRepoDiff(repoPath: string): Promise<string> {
    // console.debug(`getRepoDiff: ${repoPath}`);
    const git = getGit(repoPath);
    return await git.diff();
}

export async function getRepoDiffSummary(
    repoPath: string,
): Promise<{ inserted: number; deleted: number }> {
    // console.debug(`getRepoDiffSummary: ${repoPath}`);
    const git = getGit(repoPath);
    const summary = await git.diffSummary();
    return { inserted: summary.insertions, deleted: summary.deletions };
}

export async function runCommit(
    repoPath: string,
    message: string,
    files: string[] = ["."],
): Promise<void> {
    // console.debug(`runCommit: ${repoPath} - "${message}"`);
    const git = getGit(repoPath);
    await git.add(files);
    await git.commit(message);
}

export async function runPush(repoPath: string): Promise<void> {
    // console.debug(`runPush: ${repoPath}`);
    const git = getGit(repoPath);
    await git.push();
}
