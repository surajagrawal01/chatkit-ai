import { GoogleGenAI } from "@google/genai";
import type { AIProvider, ChatMessage } from "./types";
import { SYSTEM_PROMPT } from "./prompts";

/** True when `error` is the abort we caused ourselves via `signal`, as opposed to a real failure. */
function signalAborted(signal: AbortSignal | undefined, error: unknown): boolean {
    return Boolean(signal?.aborted) || (error instanceof DOMException && error.name === "AbortError");
}

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


    async generateReplyStream(messages: ChatMessage[], options?: { systemPrompt?: string; signal?: AbortSignal; }): Promise<ReadableStream> {
        try {
            if (messages.length === 0) {
                throw new Error(
                    "At least one message is required"
                );
            }

            const signal = options?.signal;

            // Client already gone (e.g. Stop clicked before we even hit the network) —
            // don't spend a Gemini call on a response nobody will read.
            if (signal?.aborted) {
                throw new DOMException("Aborted before request started", "AbortError");
            }

            const geminiStream = await this.client.models.generateContentStream({
                model: this.model,
                contents: this.mapMessages(messages),
                config: {
                    systemInstruction:
                        options?.systemPrompt
                        ?? SYSTEM_PROMPT,

                    temperature:
                        0.7,

                    maxOutputTokens:
                        1024,

                    // Passed straight to the underlying fetch as aborting this tears down that 
                    // HTTP request too, so Gemini stops billing/generating tokens.
                    abortSignal: signal,
                },
            })
            const encoder = new TextEncoder();

            return new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of geminiStream) {
                            // Belt-and-suspenders: bail the moment the client disconnects,
                            // even if a chunk was already in flight when abort fired.
                            if (signal?.aborted) break;

                            controller.enqueue(
                                encoder.encode(
                                    chunk.text ?? ""
                                )
                            );
                        }
                        controller.close();
                    } catch (error) {
                        if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
                            // Expected: user hit Stop or navigated away mid-stream.
                            // Just end the stream quietly, nothing downstream is listening anyway.
                            controller.close();
                            return;
                        }
                        console.error("[GeminiProvider] stream error", error);
                        controller.error(error);
                    }
                },
                cancel() {
                    // Fires if the ReadableStream's *consumer* (route.ts's Response) stops
                    // reading — e.g. the HTTP response itself got aborted. Nothing extra to
                    // clean up here since `signal` already tears down the Gemini request.
                },
            })
        } catch (error) {
            if (signalAborted(options?.signal, error)) {
                // Not a real failure — don't log it as one.
                throw error;
            }
            console.error(
                "[GeminiProvider]",
                error
            );

            throw error;
        }
    }
}