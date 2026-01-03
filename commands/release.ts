import { readFile } from "node:fs/promises";
import path from "node:path";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import chalk from "chalk";

// Define the release entity interface
interface ReleaseEntity {
	partitionKey: string; // Year
	rowKey: string; // Release ID
	title: string;
	date: string; // ISO string
	apps: string; // JSON string array
	body: string; // Markdown
}

interface AzureError {
	statusCode?: number;
	code?: string;
	message?: string;
}

export async function release(releaseNumber: string) {
	const releasesFolder = process.env.RELEASES_FOLDER;
	if (!releasesFolder) {
		console.error(
			chalk.red("Error: RELEASES_FOLDER environment variable is not set."),
		);
		process.exit(1);
	}

	const releaseFile = path.join(releasesFolder, `release-${releaseNumber}.md`);

	console.log(chalk.blue(`Preparing Release ${releaseNumber}...`));
	console.log(chalk.gray(`Reading from: ${releaseFile}`));

	try {
		const releaseContent = await readFile(releaseFile, "utf-8");

		// 1. Parse Apps from Content headers
		// Header format: # AppName
		// Example: # Nina.Home
		const appHeaderRegex = /^#\s+([a-zA-Z0-9.-]+)/gm;
		const appsSet = new Set<string>();

		const matches = releaseContent.matchAll(appHeaderRegex);
		for (const match of matches) {
			if (match[1]) {
				const appName = match[1].trim().toLowerCase().replace(/\./g, "-");
				appsSet.add(appName);
			}
		}

		const apps = Array.from(appsSet);
		console.log(
			chalk.green(`Found ${apps.length} changed apps: ${apps.join(", ")}`),
		);

		// 2. Prepare Entity Data
		const year = new Date().getFullYear().toString();
		const releaseId = releaseNumber;
		const title = `Release-${releaseNumber}`;

		const entity: ReleaseEntity = {
			partitionKey: year,
			rowKey: releaseId,
			title: title,
			date: new Date().toISOString(),
			apps: JSON.stringify(apps),
			body: releaseContent,
		};

		// 3. Update Azure Table Storage
		const tableName = "releases";
		const accountName =
			process.env.AZURE_STORAGE_ACCOUNT_NAME || "ninalabsstorage";
		const endpoint = `https://${accountName}.table.core.windows.net`;

		console.log(
			chalk.blue(
				`Connecting to Azure Table Storage: ${endpoint} (Table: ${tableName})...`,
			),
		);

		const credential = new DefaultAzureCredential();
		const client = new TableClient(endpoint, tableName, credential);

		try {
			await client.createTable();
		} catch (createError: unknown) {
			const e = createError as AzureError;
			if (e.statusCode !== 409) {
				throw e; // Rethrow if not "Already Exists"
			}
		}

		console.log(chalk.blue("Upserting release entity..."));
		await client.upsertEntity(entity, "Replace");

		console.log(
			chalk.green(`Creation of Release ${releaseNumber} Successful!`),
		);
	} catch (error: unknown) {
		const e = error as AzureError & { code?: string };
		if (e.code === "ENOENT") {
			console.error(chalk.red(`Error: Release file not found: ${releaseFile}`));
		} else {
			console.error(chalk.red("Failed to create release:"), error);
		}
		process.exit(1);
	}
}
