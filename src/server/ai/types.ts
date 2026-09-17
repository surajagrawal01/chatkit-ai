export type ChatRole = "user" | "assistant" | "system";

export type ChatMessageStatus = "streaming" | "done" | "stopped" | "error";

export interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    status?: ChatMessageStatus;
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