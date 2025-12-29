import fs from "node:fs/promises";
import path from "node:path";
import type { ShipperPlan } from "./types";

const PLAN_FILENAME = "shipper.plan.json";

export async function writePlan(plan: ShipperPlan): Promise<void> {
	const filePath = path.resolve(process.cwd(), PLAN_FILENAME);
	// console.debug(
	// 	`writePlan: Writing plan to ${filePath} with ${plan.actions.length} actions.`,
	// );
	await fs.writeFile(filePath, JSON.stringify(plan, null, 2), "utf-8");
	console.log(`Plan written to ${filePath}`);
}

export async function readPlan(): Promise<ShipperPlan | null> {
	const filePath = path.resolve(process.cwd(), PLAN_FILENAME);
	// console.debug(`readPlan: Reading plan from ${filePath}`);
	try {
		const content = await fs.readFile(filePath, "utf-8");
		return JSON.parse(content) as ShipperPlan;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			// console.debug(`readPlan: No plan file found.`);
			return null;
		}
		throw error;
	}
}

export async function deletePlan(): Promise<void> {
	const filePath = path.resolve(process.cwd(), PLAN_FILENAME);
	// console.debug(`deletePlan: Deleting ${filePath}`);
	try {
		await fs.unlink(filePath);
		console.log(`Plan file ${PLAN_FILENAME} deleted.`);
	} catch (error) {
		// Ignore if not found
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
		// console.debug(`deletePlan: File not found (already deleted?)`);
	}
}
