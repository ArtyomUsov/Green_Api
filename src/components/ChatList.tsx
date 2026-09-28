import { useState, type FormEvent } from "react";
import type { Chat } from "../types";

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
  onCreateChat: (phone: string) => void;
  creatingChat: boolean;
  createChatError: string | null;
  /** idInstance of the logged-in account, shown in the profile strip. */
  idInstance: string;
  onLogout: () => void;
  instanceStatus: {
    stateInstance?: string;
  };
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatList({
  chats,
  activeChatId,
  onSelect,
  onCreateChat,
  creatingChat,
  createChatError,
  idInstance,
  onLogout,
  instanceStatus,
}: ChatListProps) {
  const [phone, setPhone] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    onCreateChat(phone);
  }

  return (
    <aside className="chat-list">
      <header className="chat-list-header">
        <span className="chat-list-logo">MAX Chat</span>
      </header>

      {/* Instance health: warn when the instance is not authorized */}
      {instanceStatus.stateInstance &&
        instanceStatus.stateInstance !== "authorized" && (
          <div className="instance-warning">
            Инстанс не авторизован ({instanceStatus.stateInstance}).
            Отсканируйте QR-код в личном кабинете GREEN-API.
          </div>
        )}

      <div className="chat-list-status">
        <span
          className={`status-dot ${
            instanceStatus.stateInstance === "authorized" ? "ok" : "warn"
          }`}
        />
        <span>
          {instanceStatus.stateInstance
            ? instanceStatus.stateInstance === "authorized"
              ? "Инстанс авторизован"
              : `Инстанс: ${instanceStatus.stateInstance}`
            : "Проверка статуса…"}
        </span>
      </div>

      {showNewChat ? (
        <form className="new-chat-form" onSubmit={handleCreate}>
          <input
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Номер телефона, напр. 79991234567"
            inputMode="tel"
          />
          <div className="new-chat-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={creatingChat}
            >
              {creatingChat ? "Создание…" : "Создать чат"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setShowNewChat(false);
                setPhone("");
              }}
            >
              Отмена
            </button>
          </div>
          {createChatError && (
            <div className="form-error">{createChatError}</div>
          )}
        </form>
      ) : (
        <button
          className="new-chat-button"
          onClick={() => setShowNewChat(true)}
        >
          + Новый чат
        </button>
      )}

      <div className="chat-list-items">
        {/* Mobile-only hint above the list */}
        <div className="chat-list-mobile-hint">
          Выберите чат или создайте новый по номеру телефона
        </div>
        {chats.length === 0 && (
          <div className="chat-list-empty">
            Пока нет чатов.
            <br />
            Создайте чат по номеру телефона получателя.
          </div>
        )}
        {chats.map((chat) => {
          const last = chat.messages.at(-1);
          return (
            <button
              key={chat.chatId}
              className={`chat-item ${
                chat.chatId === activeChatId ? "active" : ""
              }`}
              onClick={() => onSelect(chat.chatId)}
            >
              <span className="chat-item-avatar">{chat.title.slice(0, 1)}</span>
              <span className="chat-item-body">
                <span className="chat-item-title">{chat.title}</span>
                <span className="chat-item-preview">
                  {last
                    ? (last.outgoing ? "Вы: " : "") + last.text
                    : "Нет сообщений"}
                </span>
              </span>
              <span className="chat-item-side">
                {last && (
                  <span className="chat-item-time">
                    {formatTime(last.timestamp)}
                  </span>
                )}
                {chat.unreadCount > 0 && (
                  <span className="chat-item-unread">{chat.unreadCount}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Profile strip: active instance + logout, like in web.max.ru */}
      <footer className="chat-list-profile">
        {confirmLogout ? (
          <div className="logout-confirm">
            <span>Выйти из аккаунта?</span>
            <div className="logout-confirm-actions">
              <button
                type="button"
                className="logout-confirm-button"
                onClick={onLogout}
              >
                Выйти
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setConfirmLogout(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="chat-item-avatar profile-avatar">
              {(idInstance || "?").slice(0, 1)}
            </span>
            <span className="profile-body">
              <span className="profile-title">Инстанс {idInstance || "—"}</span>
              <span className="profile-subtitle">GREEN-API аккаунт</span>
            </span>
            <button
              type="button"
              className="logout-button"
              title="Выйти из аккаунта"
              onClick={() => setConfirmLogout(true)}
            >
              Выйти
            </button>
          </>
        )}
      </footer>
    </aside>
  );
}
