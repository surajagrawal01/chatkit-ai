interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
    loading: boolean;
}

export function ChatInput({
    value,
    onChange,
    onSend,
    onStop,
    loading,
}: ChatInputProps) {
    return (
        <div className="border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="max-w-4xl mx-auto flex gap-3">
                <input
                    type="text"
                    value={value}
                    disabled={loading}
                    placeholder="Ask anything..."
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            onSend();
                        }
                    }}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-zinc-500"
                />

                {loading ? (
                    <button
                        onClick={onStop}
                        className="rounded-xl bg-zinc-700 px-6 py-3 font-medium hover:bg-zinc-600"
                    >
                        Stop
                    </button>
                ) : (
                    <button
                        onClick={onSend}
                        disabled={!value.trim()}
                        className="rounded-xl bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
                    >
                        Send
                    </button>
                )}
            </div>
        </div>
    );
}
