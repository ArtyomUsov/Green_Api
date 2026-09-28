import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Chat } from "../types";

interface ChatWindowProps {
  chat: Chat;
  onSend: (chatId: string, text: string) => void;
  sending: boolean;
  sendError: string | null;
  onBack: () => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatWindow({
  chat,
  onSend,
  sending,
  sendError,
  onBack,
}: ChatWindowProps) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to the newest message when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.length, chat.chatId]);

  function handleSend() {
    if (!text.trim() || sending) return;
    onSend(chat.chatId, text);
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="chat-window">
      <header className="chat-window-header">
        <button className="back-button" title="Назад к чатам" onClick={onBack}>
          ←
        </button>
        <span className="chat-window-avatar">{chat.title.slice(0, 1)}</span>
        <div className="chat-window-title">
          <span>{chat.title}</span>
          {chat.phone && (
            <span className="chat-window-subtitle">{chat.phone}</span>
          )}
        </div>
      </header>

      <div className="chat-messages">
        {chat.messages.length === 0 && (
          <div className="chat-messages-empty">
            Нет сообщений. Напишите первое — получатель увидит его в MAX.
          </div>
        )}
        {chat.messages.map((m) => (
          <div
            key={m.id}
            className={`message-row ${m.outgoing ? "out" : "in"}`}
          >
            <div
              className={`message-bubble ${m.outgoing ? "out" : "in"} ${
                m.status === "failed" ? "failed" : ""
              }`}
            >
              <div className="message-text">{m.text}</div>
              <div className="message-meta">
                <span className="message-time">{formatTime(m.timestamp)}</span>
                {m.outgoing && (
                  <span className="message-status">
                    {m.status === "sending"
                      ? "⏳"
                      : m.status === "failed"
                      ? "✕"
                      : m.status === "read"
                      ? "✓✓"
                      : "✓"}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {sendError && <div className="chat-send-error">{sendError}</div>}

      <footer className="chat-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение…"
          rows={1}
          maxLength={4000}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={sending || !text.trim()}
          title="Отправить (Enter)"
        >
          ➤
        </button>
      </footer>
    </section>
  );
}
