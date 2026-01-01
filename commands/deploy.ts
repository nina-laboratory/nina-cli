import { exec } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import chalk from "chalk";
import "dotenv/config";

const execAsync = promisify(exec);

interface Artifact {
	name: string;
	archive_download_url: string;
}

interface Tags {
	[key: string]: string;
}

interface ArtifactsResponse {
	artifacts: Artifact[];
}

export async function deploy(url: string) {
	const token = process.env.GITHUB_PAT;
	if (!token) {
		console.error(
			chalk.red("Error: GITHUB_PAT environment variable is not set."),
		);
		process.exit(1);
	}

	const tfVarsFile = process.env.TF_VARS_FILE;
	if (!tfVarsFile) {
		console.error(
			chalk.red("Error: TF_VARS_FILE environment variable is not set."),
		);
		process.exit(1);
	}

	const runIdMatch = url.match(/actions\/runs\/(\d+)/);
	if (!runIdMatch) {
		console.error(
			chalk.red(
				"Error: Invalid GitHub Actions run URL. Could not extract Run ID.",
			),
		);
		process.exit(1);
	}
	const runId = runIdMatch[1];
	const owner = "nina-laboratory";
	const repo = "nina-infra";

	console.log(chalk.blue(`Fetching artifacts for run ${runId}...`));

	try {
		// 1. List Artifacts
		const artifactsRes = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github.v3+json",
				},
			},
		);

		if (!artifactsRes.ok) {
			throw new Error(`Failed to list artifacts: ${artifactsRes.statusText}`);
		}

		const artifactsData = (await artifactsRes.json()) as ArtifactsResponse;
		const artifact = artifactsData.artifacts.find(
			(a) => a.name === "generated_tags",
		);

		if (!artifact) {
			throw new Error("Artifact 'generated_tags' not found in this run.");
		}

		// 2. Download Artifact
		console.log(chalk.blue("Downloading generated_tags artifact..."));
		const downloadRes = await fetch(artifact.archive_download_url, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!downloadRes.ok) {
			throw new Error(`Failed to download artifact: ${downloadRes.statusText}`);
		}

		const buffer = await downloadRes.arrayBuffer();
		const tempDir = os.tmpdir();
		const zipPath = path.join(tempDir, `nina-tags-${runId}.zip`);
		await fs.writeFile(zipPath, Buffer.from(buffer));

		// 3. Unzip and Read
		console.log(chalk.blue("Extracting tags..."));

		const extractDir = path.join(tempDir, `nina-extract-${runId}`);
		await fs.mkdir(extractDir, { recursive: true });
		await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`);

		const extractedFiles = await fs.readdir(extractDir);
		let tagsJson: Tags | null = null;

		for (const file of extractedFiles) {
			try {
				const content = await fs.readFile(path.join(extractDir, file), "utf-8");
				const json = JSON.parse(content);
				if (json["nina-fit"] || json["nina-journal"] || json["nina-quick"]) {
					tagsJson = json;
					break;
				}
			} catch {
				// Not a json or not the right one
			}
		}

		if (!tagsJson) {
			throw new Error("Could not find valid tags JSON in artifact.");
		}

		// 4. Update terraform.tfvars
		console.log(chalk.blue(`Updating ${tfVarsFile}...`));
		let tfVarsContent = await fs.readFile(tfVarsFile, "utf-8");

		const mapping: Record<string, string> = {
			"nina-fit": "fit",
			"nina-journal": "journal",
			"nina-quick": "quick",
		};

		// We want to replace lines like 'fit = "oldhash"' with 'fit = "newhash"'
		// inside the image_tags block ideally.
		// Simple regex update for specific keys:

		for (const [key, value] of Object.entries(tagsJson)) {
			const tfKey = mapping[key];
			if (tfKey) {
				// Regex to match:  key   = "value"  (with variable spaces)
				const regex = new RegExp(`(${tfKey}\\s*=\\s*")([^"]+)(")`, "g");
				if (regex.test(tfVarsContent)) {
					tfVarsContent = tfVarsContent.replace(regex, `$1${value}$3`);
					console.log(chalk.green(`Updated ${tfKey} to ${value}`));
				} else {
					console.warn(
						chalk.yellow(
							`Warning: Could not find key '${tfKey}' in tfvars file. `,
						),
					);
				}
			}
		}

		await fs.writeFile(tfVarsFile, tfVarsContent);
		console.log(chalk.green("Deployment vars updated."));

		// Cleanup artifacts
		await fs.unlink(zipPath);
		await fs.rm(extractDir, { recursive: true, force: true });

		// 5. Terraform Plan & Verify
		console.log(chalk.blue("Running Terraform plan..."));
		const tfDir = path.dirname(tfVarsFile);
		const tfVarsFileName = path.basename(tfVarsFile);

		try {
			await execAsync(
				`terraform plan -out=tfplan -var-file=${tfVarsFileName}`,
				{ cwd: tfDir },
			);
		} catch {
			throw new Error("Terraform plan failed. Please check output.");
		}

		console.log(chalk.blue("Verifying plan..."));
		const { stdout: planJsonStr } = await execAsync(
			`terraform show -json tfplan`,
			{ cwd: tfDir },
		);
		const planJson = JSON.parse(planJsonStr);

		const resourceChanges = planJson.resource_changes || [];
		const validResourceTypes = [
			"azurerm_container_app",
			"azurerm_container_app_revision",
		]; // Adjust if needed

		let hasChanges = false;

		for (const change of resourceChanges) {
			const actions = change.change.actions;
			if (actions.includes("no-op")) continue;

			hasChanges = true;
			if (!validResourceTypes.includes(change.type)) {
				throw new Error(
					`Plan contains changes to unexpected resource type: ${change.type} (${change.address}). Aborting.`,
				);
			}

			// Checking if it's an update (not create/delete if strict)?
			// User said "check if ONLY the container apps are affected (version are changed)"
			// Usually valid to just check type.
		}

		if (!hasChanges) {
			console.log(chalk.yellow("No changes detected in plan."));
			return;
		}

		console.log(
			chalk.green("Plan verified: Only container apps are affected."),
		);

		// 6. Terraform Apply
		console.log(chalk.blue("Applying Terraform plan..."));
		await execAsync(`terraform apply -auto-approve tfplan`, { cwd: tfDir });

		// Remove plan file
		await fs.unlink(path.join(tfDir, "tfplan"));

		console.log(chalk.green("Deployment applied successfully!"));
	} catch (error) {
		console.error(chalk.red("Failed to deploy:"));
		if (error instanceof Error) {
			console.error(chalk.red(error.message));
		} else {
			console.error(chalk.red(String(error)));
		}
		process.exit(1);
	}
}
