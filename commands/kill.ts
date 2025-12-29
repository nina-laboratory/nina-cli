import { exec } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { listProcesses, printProcessTable } from "./list";

// import inquirer from "inquirer"; // We might want confirmation later, but user didn't ask for it explicitly in requirement "Another one to kill processes from these ports" - assuming direct kill for now or maybe better to confirm?
// Requirement says "Another one to kill processes from these ports."
// I'll implement a bulk kill for now.

const execAsync = promisify(exec);

export async function killProcesses(startPort: number, endPort: number) {
	const processes = await listProcesses(startPort, endPort);

	if (processes.length === 0) {
		console.log(
			chalk.yellow(
				`No processes found between ports ${startPort} and ${endPort}.`,
			),
		);
		return;
	}

	console.log(chalk.bold(`Found ${processes.length} processes to kill:`));
	await printProcessTable(processes);

	for (const p of processes) {
		try {
			process.stdout.write(
				`Killing ${p.command} (PID: ${p.pid}) on port ${p.port}... `,
			);
			await execAsync(`kill -9 ${p.pid}`);
			console.log(chalk.green("Done"));
		} catch (error: unknown) {
			console.log(chalk.red("Failed"));
			const err = error as Error;
			console.error(chalk.red(`Error killing PID ${p.pid}:`), err.message);
		}
	}
}
