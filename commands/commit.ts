import path from "node:path";
import readline from "node:readline/promises";
import chalk from "chalk";
import Table from "cli-table3";
import { config } from "../lib/config";
import {
	getRepoDiff,
	getRepoDiffSummary,
	getRepoStatus,
	runCommit,
	runPush,
} from "../lib/git";
import { LLMService } from "../lib/llm";
import { deletePlan, readPlan, writePlan } from "../lib/persistence/plan-file";
import type {
	CommitAction,
	ShipperPlan,
	VersionUpdate,
} from "../lib/persistence/types";
import { incrementVersion, readVersion, writeVersion } from "../lib/version";

export async function commit() {
	// --- PLAN PHASE ---
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
					const vFilePath = path.join(appPathRelative, "version.txt");
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

	const initialPlan: ShipperPlan = {
		createdAt: new Date().toISOString(),
		actions,
	};

	await writePlan(initialPlan);

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
	console.log(
		chalk.dim(
			"\nYou can edit 'shipper.plan.json' now to modify commit messages or versions.",
		),
	);

	// --- PROMPT PHASE ---
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const answer = await rl.question(
		`\n${chalk.bold("Do you want to proceed? (yes/no)")} `,
	);
	rl.close();

	if (answer.toLowerCase() !== "yes") {
		console.log(chalk.yellow("Operation cancelled."));
		await deletePlan();
		return;
	}

	// --- APPLY PHASE ---
	console.log(chalk.blue("\nApplying deployment..."));

	// Re-read plan to pick up any manual edits
	const plan = await readPlan();
	if (!plan) {
		console.error(
			chalk.red("Error: 'shipper.plan.json' not found or invalid."),
		);
		process.exit(1);
	}

	const applyTable = new Table({
		head: [chalk.cyan("Repo"), chalk.cyan("Action"), chalk.cyan("Status")],
	});

	for (const action of plan.actions) {
		// 1. Update Version Files
		if (action.versionUpdates.length > 0) {
			for (const update of action.versionUpdates) {
				const fullPath = path.resolve(action.repoPath, update.filePath);
				try {
					await writeVersion(fullPath, update.newVersion);
					applyTable.push([
						action.repoName,
						`Update version ${update.filePath}`,
						chalk.green("Done"),
					]);
				} catch (e: unknown) {
					const err = e as Error;
					applyTable.push([
						action.repoName,
						`Update version ${update.filePath}`,
						chalk.red(`Failed: ${err.message}`),
					]);
				}
			}
		}

		// 2. Commit
		try {
			await runCommit(action.repoPath, action.commitMessage, ["."]);
			applyTable.push([
				action.repoName,
				`Commit: "${action.commitMessage}"`,
				chalk.green("Done"),
			]);

			// 3. Push
			await runPush(action.repoPath);
			applyTable.push([action.repoName, `Push to remote`, chalk.green("Done")]);
		} catch (error: unknown) {
			const err = error as Error;
			applyTable.push([
				action.repoName,
				`Push/Commit`,
				chalk.red(`Failed: ${err.message}`),
			]);
		}
	}

	console.log(applyTable.toString());

	await deletePlan();
	console.log(chalk.green("\nAll actions processed. Plan deleted."));
}
