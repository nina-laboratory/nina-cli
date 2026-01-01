import chalk from "chalk";
import "dotenv/config";

export async function build() {
	const token = process.env.GITHUB_PAT;
	if (!token) {
		console.error(
			chalk.red("Error: GITHUB_PAT environment variable is not set."),
		);
		process.exit(1);
	}

	const owner = "nina-laboratory";
	const repo = "nina-infra";
	const workflowId = "build-and-push.yml";
	const ref = "main"; // Or make this configurable/argument

	console.log(
		chalk.blue(`Triggering workflow ${workflowId} on ${owner}/${repo}...`),
	);

	try {
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github.v3+json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					ref: ref,
				}),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`GitHub API responded with ${response.status}: ${errorText}`,
			);
		}

		console.log(chalk.green("Workflow triggered successfully."));
		console.log(
			chalk.gray(
				`Check progress at: https://github.com/${owner}/${repo}/actions/workflows/${workflowId}`,
			),
		);
	} catch (error) {
		console.error(chalk.red("Failed to trigger workflow:"));
		if (error instanceof Error) {
			console.error(chalk.red(error.message));
		} else {
			console.error(chalk.red(String(error)));
		}
		process.exit(1);
	}
}
