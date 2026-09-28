import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import { useChatStore } from "../hooks/useChatStore";
import type { GreenApiCredentials } from "../api/greenApi";

interface ChatScreenProps {
  credentials: GreenApiCredentials;
  onLogout: () => void;
}

/**
 * Authenticated screen. Mounted only after login, so credentials
 * inside the chat store are always present.
 */
export default function ChatScreen({ credentials, onLogout }: ChatScreenProps) {
  const store = useChatStore(credentials);

  return (
    <div className={`chat-layout${store.activeChat ? " chat-opened" : ""}`}>
      <ChatList
        chats={store.chats}
        activeChatId={store.activeChatId}
        onSelect={store.setActiveChatId}
        onCreateChat={store.createChatByPhone}
        creatingChat={store.creatingChat}
        createChatError={store.createChatError}
        idInstance={credentials.idInstance}
        onLogout={onLogout}
        instanceStatus={store.instanceStatus}
      />
      {store.activeChat ? (
        <ChatWindow
          chat={store.activeChat}
          onSend={store.sendTextMessage}
          sending={store.sending}
          sendError={store.sendError}
          onBack={() => store.setActiveChatId("")}
        />
      ) : (
        <div className="chat-window-placeholder">
          Выберите чат слева или создайте новый по номеру телефона
        </div>
      )}
    </div>
  );
}
