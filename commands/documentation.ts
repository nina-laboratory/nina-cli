import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { config } from "../lib/config";

export async function documentation() {
    console.log(chalk.blue("Syncing documentation from Obsidian..."));

    const appsFolder = process.env.APPS_FOLDER;
    if (!appsFolder) {
        console.error(chalk.red("Error: APPS_FOLDER environment variable is not set."));
        process.exit(1);
    }

    if (!fs.existsSync(appsFolder)) {
        console.error(
            chalk.red(`Error: APPS_FOLDER path does not exist: ${appsFolder}`),
        );
        process.exit(1);
    }

    const repos = config.repos;

    for (const repo of repos) {
        for (const app of repo.apps) {
            const appName = app.name;
            const sourcePath = path.join(appsFolder, `${appName}.md`);

            if (fs.existsSync(sourcePath)) {
                // Construct destination path: repo root -> repo path -> app path -> DOCUMENTATION.md
                const repoPath = path.resolve(config.rootPath, repo.path);
                const appPath = path.resolve(repoPath, app.path);
                const destPath = path.join(appPath, "DOCUMENTATION.md");

                try {
                    // Ensure destination directory exists (though app path should exist)
                    if (fs.existsSync(appPath)) {
                        fs.copyFileSync(sourcePath, destPath);
                        console.log(
                            chalk.green(`✓ Synced ${appName} documentation to ${destPath}`),
                        );
                    } else {
                        console.warn(
                            chalk.yellow(
                                `⚠ App directory not found for ${appName}: ${appPath}`,
                            ),
                        );
                    }
                } catch (error) {
                    console.error(
                        chalk.red(`✘ Failed to copy documentation for ${appName}:`),
                        error,
                    );
                }
            } else {
                console.log(
                    chalk.gray(`- No documentation found for ${appName} (checked ${sourcePath})`),
                );
            }
        }
    }

    console.log(chalk.blue("\nDocumentation sync complete."));
}
