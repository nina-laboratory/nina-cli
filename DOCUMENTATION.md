# Summary
This is the Nina CLI, a command-line interface (CLI) tool for automating common tasks related to Nina Labs.
# Architecture
- Bun CLI
# Nina.CLI-R1
- Create CLI tool
- Create the following commands:
	- list: Scans and lists all processes currently occupying ports 4000 to 4050.
	- kill: Terminates all processes found occupying ports 4000 to 4050.
	- commit: Plans and executes a deployment (commit & push).
	- build: Triggers the build-and-push workflow in the nina-infra repository.
	- deploy: Deploys a specific GitHub Actions run to your infrastructure using its URL.
	- release: Publishes release notes from local markdown files to Azure for a given release number.
	- start: Starts all applications that are configured with "run": true in config.json.
	- repo-structure: Verifies that your repositories adhere to the required file structure (e.g., biome.json, version.txt).
- Updated LLM model to gemini-2.0-flash-lite