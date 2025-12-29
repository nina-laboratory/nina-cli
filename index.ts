#!/usr/bin/env bun
import chalk from "chalk";
import { Command } from "commander";
import { killProcesses } from "./commands/kill";
import { listProcesses, printProcessTable } from "./commands/list";

const program = new Command();

program
	.name("nina")
	.description("Nina.CLI - Helpful tools for development")
	.version("1.0.0");

program
	.command("list")
	.description("List all processes occupying ports 3000 to 3050")
	.action(async () => {
		console.log(chalk.blue("Scanning ports 3000-3050..."));
		const processes = await listProcesses(3000, 3050);
		await printProcessTable(processes);
	});

program
	.command("kill")
	.description("Kill all processes occupying ports 3000 to 3050")
	.action(async () => {
		await killProcesses(3000, 3050);
	});

program
	.command("plan")
	.description("Scan repos and generate a deployment plan")
	.action(async () => {
		const { createPlan } = await import("./commands/plan");
		await createPlan();
	});

program
	.command("apply")
	.description("Execute a previously generated deployment plan")
	.action(async () => {
		const { executePlan } = await import("./commands/apply");
		await executePlan();
	});

program.parse(process.argv);
