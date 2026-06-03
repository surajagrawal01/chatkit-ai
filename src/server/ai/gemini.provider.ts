import { GoogleGenAI } from "@google/genai";
import type { AIProvider, ChatMessage } from "./types";
import { SYSTEM_PROMPT } from "./prompts";


export class GeminiProvider implements AIProvider {
    readonly name = "gemini";
    private client: GoogleGenAI;
    private readonly model =
        process.env.GEMINI_MODEL ??
        "gemini-2.5-flash";

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error(
                "GEMINI_API_KEY is not configured"
            );
        }

        this.client = new GoogleGenAI({
            apiKey
        })
    }

    private mapMessages(
        messages: ChatMessage[]
    ) {
        return messages.map((m) => {
            return {
                role: m?.role === "assistant" ? "model" : "user",
                parts: [
                    {
                        text: m?.content
                    }
                ]
            }
        })
    }

    async generateReply(messages: ChatMessage[], options?: { systemPrompt?: string; }): Promise<string> {
        try {
            if (messages.length === 0) {
                throw new Error(
                    "At least one message is required"
                );
            }

            const response = await this.client.models.generateContent({
                model: this.model,
                contents: this.mapMessages(messages),
                config: {
                    systemInstruction:
                        options?.systemPrompt
                        ?? SYSTEM_PROMPT,

                    temperature:
                        0.7,

                    maxOutputTokens:
                        1024
                }
            })

            return response?.text ?? "";
        } catch (error) {
            console.error(
                "[GeminiProvider]",
                error
            );

            throw error;
        }
    }
}