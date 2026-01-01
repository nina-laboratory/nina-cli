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

	const releaseMetaFile = path.join(
		releasesFolder,
		`Release-${releaseNumber}.md`,
	);
	const releaseBodyFile = path.join(
		releasesFolder,
		`Release-${releaseNumber}-MD.md`,
	);

	console.log(chalk.blue(`Preparing Release ${releaseNumber}...`));
	console.log(chalk.gray(`Reading metadata from: ${releaseMetaFile}`));
	console.log(chalk.gray(`Reading body from: ${releaseBodyFile}`));

	try {
		const [metaContent, bodyContent] = await Promise.all([
			readFile(releaseMetaFile, "utf-8"),
			readFile(releaseBodyFile, "utf-8"),
		]);

		// 1. Parse Apps from Metadata
		// Look for lines like ![[Nina.Home#Nina.Home-R1]]
		const appRegex = /!\[\[(.*?)(?:#.*)?\]\]/g;
		const appsSet = new Set<string>();

		// Biome friendly regex loop
		const matches = metaContent.matchAll(appRegex);
		for (const match of matches) {
			if (match[1]) {
				const appNameRaw = match[1].split("#")[0];
				if (appNameRaw) {
					const appName = appNameRaw.toLowerCase().replace(/\./g, "-");
					appsSet.add(appName);
				}
			}
		}

		const apps = Array.from(appsSet);
		console.log(
			chalk.green(`Found ${apps.length} changed apps: ${apps.join(", ")}`),
		);

		// 2. Prepare Entity Data
		const year = new Date().getFullYear().toString();
		const releaseId = releaseNumber;
		// We can try to extract a title from the body if it has a header, or just default.
		// User didn't specify title extraction, so "Release X" is a safe default.
		// Or maybe check the first line of body?
		let title = `Release ${releaseNumber}`;
		const lines = bodyContent.split("\n");
		if (lines.length > 0 && lines[0]?.startsWith("# ")) {
			title = lines[0].substring(2).trim();
		}

		const entity: ReleaseEntity = {
			partitionKey: year,
			rowKey: releaseId,
			title: title,
			date: new Date().toISOString(),
			apps: JSON.stringify(apps),
			body: bodyContent,
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

		await client.createTable();
		// Helper to insure table exists is done by createTable (it creates if not exists usually, or we catch 409).
		// Actually createTable throws if exists. explicit create?
		// client.createTable() creates it. If it exists it might throw?
		// Let's safe create table.
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
			console.error(
				chalk.red(
					`Error: Clean file not found. Make sure Release-${releaseNumber}.md and Release-${releaseNumber}-MD.md exist in ${releasesFolder}`,
				),
			);
		} else {
			console.error(chalk.red("Failed to create release:"), error);
		}
		process.exit(1);
	}
}
