import fs from "node:fs/promises";

export async function readVersion(filePath: string): Promise<string> {
	// console.debug(`readVersion: ${filePath}`);
	try {
		const content = await fs.readFile(filePath, "utf-8");
		return content.trim();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			// console.debug(`readVersion: File not found, defaulting to 0.0.0`);
			return "0.0.0"; // Default if missing
		}
		throw error;
	}
}

export async function writeVersion(
	filePath: string,
	version: string,
): Promise<void> {
	// console.debug(`writeVersion: ${filePath} -> ${version}`);
	await fs.writeFile(filePath, version, "utf-8");
}

export function incrementVersion(
	version: string,
	type: "major" | "minor" = "minor",
): string {
	const parts = version.split(".").map((n) => parseInt(n, 10));

	// Helper to ensure valid number
	const parsePart = (val: number | undefined): number => {
		if (val === undefined || Number.isNaN(val)) return 0;
		return val;
	};

	// Normalize to at least 2 parts (Major.Minor)
	const major = parsePart(parts[0]);
	const minor = parsePart(parts[1]);

	switch (type) {
		case "major":
			return `${major + 1}.0`;

		default:
			return `${major}.${minor + 1}`;
	}
}
