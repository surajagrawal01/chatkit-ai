export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
}

export interface AIProvider {
    readonly name: string;
    generateReply(
        messages: ChatMessage[],
        options?: { systemPrompt?: string }
    ): Promise<string>;

    //For Streaming
    generateReplyStream(
        messages: ChatMessage[],
        options?: { systemPrompt?: string, signal?: AbortSignal }
    ): Promise<ReadableStream>;
}