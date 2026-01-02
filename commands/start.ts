import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import chalk from "chalk";
import { config } from "../lib/config";

const colors = [
	chalk.cyan,
	chalk.green,
	chalk.yellow,
	chalk.magenta,
	chalk.blue,
	chalk.red,
];

export async function start() {
	console.log(chalk.bold.blue("Starting apps..."));

	const rootDir = config.rootPath
		? path.resolve(process.cwd(), config.rootPath)
		: process.cwd();

	const processes: { process: ChildProcess; name: string }[] = [];
	let colorIndex = 0;

	for (const repo of config.repos) {
		const repoPath = path.resolve(rootDir, repo.path);

		for (const app of repo.apps) {
			if (app.run) {
				const appPath = path.resolve(repoPath, app.path);
				const color = colors[colorIndex % colors.length]!;
				colorIndex++;

				const port = app.port;
				if (!port) {
					console.warn(
						chalk.yellow(
							`Warning: No port configured for ${app.name}, skipping...`,
						),
					);
					continue;
				}

				console.log(
					chalk.bold(
						`Starting ${color(app.name)} at ${appPath} on port ${port}...`,
					),
				);

				const child = spawn(
					"bunx",
					["next", "dev", "--webpack", "--port", port.toString()],
					{
						cwd: appPath,
						env: { ...process.env, FORCE_COLOR: "1" },
						shell: true,
					},
				);

				processes.push({ process: child, name: app.name });

				child.stdout.on("data", (data) => {
					const lines = data.toString().split("\n");
					for (const line of lines) {
						if (line.trim()) {
							console.log(`${color(`[${app.name}]`)} ${line}`);
						}
					}
				});

				child.stderr.on("data", (data) => {
					const lines = data.toString().split("\n");
					for (const line of lines) {
						if (line.trim()) {
							console.error(`${color(`[${app.name}]`)} ${line}`);
						}
					}
				});

				child.on("error", (err) => {
					console.error(
						chalk.red(`Error starting ${app.name}: ${err.message}`),
					);
				});

				child.on("close", (code) => {
					if (code !== 0 && code !== null) {
						console.log(
							chalk.red(`[${app.name}] process exited with code ${code}`),
						);
					}
				});
			}
		}
	}

	process.on("SIGINT", () => {
		console.log(chalk.bold.red("\nStopping all apps..."));
		for (const { process, name } of processes) {
			console.log(`Killing ${name}...`);
			process.kill();
		}
		process.exit(0);
	});
}
