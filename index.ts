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
		console.log(chalk.blue("Scanning ports 4000-4050..."));
		const processes = await listProcesses(4000, 4050);
		await printProcessTable(processes);
	});

program
	.command("kill")
	.description("Kill all processes occupying ports 4000 to 4050")
	.action(async () => {
		await killProcesses(4000, 4050);
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
	.command("release")
	.description("Publish release notes from Obsidian to Azure")
	.argument("<number>", "Release Number")
	.action(async (number) => {
		const { release } = await import("./commands/release");
		await release(number);
	});

program
	.command("start")
	.description("Start all apps configured with run: true")
	.action(async () => {
		const { start } = await import("./commands/start");
		await start();
	});

program
	.command("repo-structure")
	.description("Check if repositories follow the required structure")
	.action(async () => {
		const { checkRepoStructure } = await import("./commands/repo-structure");
		await checkRepoStructure();
	});

program
	.command("documentation")
	.description("Sync documentation from Obsidian vault to apps")
	.action(async () => {
		const { documentation } = await import("./commands/documentation");
		await documentation();
	});

program.parse(process.argv);
