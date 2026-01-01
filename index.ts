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

program
	.command("build")
	.description("Trigger the build-and-push workflow on nina-infra")
	.action(async () => {
		const { build } = await import("./commands/build");
		await build();
	});

program
	.command("deploy")
	.description("Deploy a GitHub run to infrastructure")
	.argument("<url>", "GitHub Actions Run URL")
	.action(async (url) => {
		const { deploy } = await import("./commands/deploy");
		await deploy(url);
	});

program
	.command("repo-structure")
	.description("Check if repositories follow the required structure")
	.action(async () => {
		const { checkRepoStructure } = await import("./commands/repo-structure");
		await checkRepoStructure();
	});

program.parse(process.argv);
