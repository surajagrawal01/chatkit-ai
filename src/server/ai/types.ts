export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
    role: ChatRole;
    content: string;
}

export interface AIProvider {
    readonly name: string;
    generateReply(
        messages: ChatMessage[],
        options?: { systemPrompt?: string }
    ): Promise<string>;
}