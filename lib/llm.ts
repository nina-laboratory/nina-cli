
import {
    type GenerativeModel,
    GoogleGenerativeAI,
} from "@google/generative-ai";

export class LLMService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }

    async generateCommitMessage(diff: string): Promise<string> {
        // console.debug(`generateCommitMessage: Input diff length=${diff.length}`);
        if (!diff || diff.trim().length === 0) {
            // console.debug(`generateCommitMessage: Empty diff, returning default.`);
            return "chore: update (no diff)";
        }

        const prompt = `
You are an expert developer. Generate a concise and conventional commit message for the following git diff.
The format should be conventional commits (e.g., feat: ..., fix: ..., chore: ...).
Do not create a subject line longer than 72 characters if possible.
Just return the commit message, nothing else.

Diff:
${diff.substring(0, 10000)} // Truncate to avoid token limits if massive
`;

        try {
            // console.debug(`generateCommitMessage: Sending prompt to Gemini...`);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();
            // console.debug(`generateCommitMessage: Received response: "${text}"`);
            return text;
        } catch (error) {
            console.error("Error generating commit message:", error);
            return "chore: update (LLM generation failed)";
        }
    }
}
