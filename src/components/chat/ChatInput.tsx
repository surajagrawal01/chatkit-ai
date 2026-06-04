interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    disabled: boolean;
}

export function ChatInput({
    value,
    onChange,
    onSend,
    disabled,
}: ChatInputProps) {
    return (
        <div className="border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="max-w-4xl mx-auto flex gap-3">
                <input
                    type="text"
                    value={value}
                    disabled={disabled}
                    placeholder="Ask anything..."
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            onSend();
                        }
                    }}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-zinc-500"
                />

                <button
                    onClick={onSend}
                    disabled={disabled || !value.trim()}
                    className="rounded-xl bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
                >
                    Send
                </button>
            </div>
        </div>
    );
}