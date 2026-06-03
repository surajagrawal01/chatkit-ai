import { AIProvider } from "./types";
import { GeminiProvider } from "./gemini.provider"

export function getAIProvider(): AIProvider {
    const provider = process.env.AI_PROVIDER ?? "gemini";

    switch (provider) {
        case "gemini":
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error(
                    "GEMINI_API_KEY is not configured"
                );
            }
            return new GeminiProvider;

        default:
            throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
    }
}