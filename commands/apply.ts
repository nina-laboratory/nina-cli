
import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { runCommit, runPush } from "../lib/git";
import { writeVersion } from "../lib/version";
import { deletePlan, readPlan } from "../lib/persistence/plan-file";

export async function executePlan() {
    console.log(chalk.blue("Applying deployment..."));

    const plan = await readPlan();
    if (!plan) {
        console.error(
            chalk.red("No 'shipper.plan.json' found. Run 'nina plan' first."),
        );
        process.exit(1);
    }

    console.log(
        `Found plan from ${plan.createdAt} with ${plan.actions.length} actions.`,
    );

    const table = new Table({
        head: [chalk.cyan("Repo"), chalk.cyan("Action"), chalk.cyan("Status")],
    });

    for (const action of plan.actions) {
        // 1. Update Version Files
        if (action.versionUpdates.length > 0) {
            for (const update of action.versionUpdates) {
                const fullPath = path.resolve(action.repoPath, update.filePath);
                try {
                    await writeVersion(fullPath, update.newVersion);
                    table.push([
                        action.repoName,
                        `Update version ${update.filePath}`,
                        chalk.green("Done"),
                    ]);
                } catch (e: any) {
                    table.push([
                        action.repoName,
                        `Update version ${update.filePath}`,
                        chalk.red(`Failed: ${e.message}`),
                    ]);
                }
            }
        }

        // 2. Commit
        try {
            await runCommit(action.repoPath, action.commitMessage, ["."]);
            table.push([
                action.repoName,
                `Commit: "${action.commitMessage}"`,
                chalk.green("Done"),
            ]);

            // 3. Push
            await runPush(action.repoPath);
            table.push([
                action.repoName,
                `Push to remote`,
                chalk.green("Done"),
            ]);

        } catch (error: any) {
            table.push([
                action.repoName,
                `Push/Commit`,
                chalk.red(`Failed: ${error.message}`),
            ]);
        }
    }

    console.log(table.toString());

    await deletePlan();
    console.log(chalk.green("\nAll actions processed. Plan deleted."));
}
