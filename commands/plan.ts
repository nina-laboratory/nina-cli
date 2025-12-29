import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { config } from "../lib/config";
import { getRepoDiff, getRepoDiffSummary, getRepoStatus } from "../lib/git";
import { LLMService } from "../lib/llm";
import { writePlan } from "../lib/persistence/plan-file";
import type {
	CommitAction,
	ShipperPlan,
	VersionUpdate,
} from "../lib/persistence/types";
import { incrementVersion, readVersion } from "../lib/version";

export async function createPlan() {
	console.log(chalk.blue("Planning deployment..."));

	const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
	if (!apiKey) {
		console.error(
			chalk.red("Error: GEMINI_API_KEY or GOOGLE_API_KEY is required in .env"),
		);
		process.exit(1);
	}

	const llm = new LLMService(apiKey);
	const actions: CommitAction[] = [];
	const rootDir = config.rootPath
		? path.resolve(process.cwd(), config.rootPath)
		: process.cwd();
	// console.debug(`Root directory: ${rootDir}`);

	for (const repo of config.repos) {
		const repoPath = path.resolve(rootDir, repo.path);
		console.log(`Checking ${chalk.cyan(repo.name)}...`);

		try {
			const status = await getRepoStatus(repoPath);

			if (status.isClean()) {
				console.log(chalk.green(`  - Clean`));
				continue;
			}

			console.log(chalk.yellow(`  - Changes detected. Generating plan...`));
			const diff = await getRepoDiff(repoPath);
			const commitMessage = await llm.generateCommitMessage(diff);

			const versionUpdates: VersionUpdate[] = [];

			for (const app of repo.apps) {
				const appPathRelative = app.path;

				const appHasChanges = status.files.some((f) => {
					if (appPathRelative === "." || appPathRelative === "./") return true;
					return f.path.startsWith(appPathRelative);
				});

				if (appHasChanges) {
					const vFilePath = path.join(appPathRelative, app.versionFile);
					const vFilePathAbsolute = path.resolve(repoPath, vFilePath);

					const currentVersion = await readVersion(vFilePathAbsolute);
					const newVersion = incrementVersion(currentVersion, "minor");

					versionUpdates.push({
						filePath: vFilePath,
						currentVersion,
						newVersion,
					});
				}
			}

			// Calculate file stats
			let created = 0;
			let modified = 0;
			let deleted = 0;

			for (const file of status.files) {
				if (file.index === "?" || file.path.includes("Untracked")) {
					created++;
				} else if (
					file.index === "A" ||
					file.working_dir === "A" ||
					file.index === "N"
				) {
					created++;
				} else if (file.index === "D" || file.working_dir === "D") {
					deleted++;
				} else {
					modified++;
				}
			}

			const diffSummary = await getRepoDiffSummary(repoPath);

			actions.push({
				repoName: repo.name,
				repoPath,
				changes: {
					files: {
						created,
						modified,
						deleted,
					},
					lines: {
						added: diffSummary.inserted,
						deleted: diffSummary.deleted,
					},
				},
				commitMessage,
				versionUpdates,
			});
		} catch (error) {
			console.error(chalk.red(`  - Error scanning ${repo.name}:`), error);
		}
	}

	if (actions.length === 0) {
		console.log(chalk.green("No changes detected in any repository."));
		return;
	}

	const plan: ShipperPlan = {
		createdAt: new Date().toISOString(),
		actions,
	};

	await writePlan(plan);

	console.log(`\n${chalk.bold("Plan Summary:")}`);
	const table = new Table({
		head: [
			chalk.cyan("Repo"),
			chalk.cyan("Files (+/-)"),
			chalk.cyan("Lines (+/-)"),
			chalk.cyan("Version Updates"),
			chalk.cyan("Commit Message"),
		],
	});

	for (const action of actions) {
		const fileStats = `${chalk.green(action.changes.files.created)}/${chalk.yellow(action.changes.files.modified)}/${chalk.red(action.changes.files.deleted)}`;
		const lineStats = `+${chalk.green(action.changes.lines.added)}/-${chalk.red(action.changes.lines.deleted)}`;
		const versions = action.versionUpdates
			.map(
				(v) =>
					`${v.filePath}: ${v.currentVersion} -> ${chalk.green(v.newVersion)}`,
			)
			.join("\n");

		table.push([
			action.repoName,
			fileStats,
			lineStats,
			versions || "-",
			action.commitMessage,
		]);
	}
	console.log(table.toString());

	console.log(`\nRun ${chalk.bold("nina apply")} to execute this plan.`);
}
