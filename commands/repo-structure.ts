import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { config } from "../lib/config";

interface RepoChecks {
	name: string;
	hasBiome: boolean;
	hasVersion: boolean;
	hasDev: boolean;
	hasLint: boolean;
	hasCheck: boolean;
	hasE2E: boolean;
}

export async function checkRepoStructure() {
	console.log(chalk.blue("Checking repository structure..."));

	const rootDir = config.rootPath
		? path.resolve(process.cwd(), config.rootPath)
		: process.cwd();

	const results: RepoChecks[] = [];

	for (const repo of config.repos) {
		const repoPath = path.resolve(rootDir, repo.path);

		// Check structural files
		const hasBiome = fs.existsSync(path.join(repoPath, "biome.json"));
		const hasVersion = fs.existsSync(path.join(repoPath, "version.txt"));

		// Check package.json scripts
		let hasDev = false;
		let hasLint = false;
		let hasCheck = false;
		let hasE2E = false;

		const packageJsonPath = path.join(repoPath, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			try {
				const packageJson = JSON.parse(
					fs.readFileSync(packageJsonPath, "utf-8"),
				);
				const scripts = packageJson.scripts || {};
				hasDev = !!scripts.dev;
				hasLint = !!scripts.lint;
				hasCheck = !!scripts.check;
				hasE2E = !!scripts.e2e;
			} catch (_error) {
				console.error(chalk.red(`Error reading package.json for ${repo.name}`));
			}
		}

		results.push({
			name: repo.name,
			hasBiome,
			hasVersion,
			hasDev,
			hasLint,
			hasCheck,
			hasE2E,
		});
	}

	const table = new Table({
		head: [
			chalk.cyan("Repo"),
			chalk.cyan("biome.json"),
			chalk.cyan("version.txt"),
			chalk.cyan("dev"),
			chalk.cyan("lint"),
			chalk.cyan("check"),
			chalk.cyan("e2e"),
		],
	});

	const checkMark = chalk.green("✓");
	const xMark = chalk.red("✗");

	for (const res of results) {
		table.push([
			res.name,
			res.hasBiome ? checkMark : xMark,
			res.hasVersion ? checkMark : xMark,
			res.hasDev ? checkMark : xMark,
			res.hasLint ? checkMark : xMark,
			res.hasCheck ? checkMark : xMark,
			res.hasE2E ? checkMark : xMark,
		]);
	}

	console.log(table.toString());
}
