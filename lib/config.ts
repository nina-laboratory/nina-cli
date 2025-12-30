import fs from "node:fs";
import path from "node:path";

export interface AppConfig {
	name: string;
	path: string; // Relative to repo root
}

export interface RepoConfig {
	name: string;
	path: string; // Relative to workspace root
	apps: AppConfig[];
}

export interface Config {
	rootPath: string;
	repos: RepoConfig[];
}

function loadConfig(): Config {
	const configPath = path.resolve(process.cwd(), "config.json");
	if (!fs.existsSync(configPath)) {
		throw new Error(`Config file not found at ${configPath}`);
	}
	const content = fs.readFileSync(configPath, "utf-8");
	return JSON.parse(content) as Config;
}

export const config = loadConfig();
