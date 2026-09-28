/** Chat message shown in the UI. */
export interface Message {
  /** idMessage from GREEN-API or temporary client id for optimistic sending. */
  id: string;
  text: string;
  /** Unix timestamp in seconds. */
  timestamp: number;
  outgoing: boolean;
  /** sending — request in flight; sent — accepted by the API; delivered/read — from webhooks. */
  status: "sending" | "sent" | "delivered" | "read" | "failed";
}

/** A chat with a single recipient. */
export interface Chat {
  /** GREEN-API chatId, e.g. "10000000". */
  chatId: string;
  /** Display name: sender name from notifications or the phone number. */
  title: string;
  /** Phone number the chat was created with (for display). */
  phone: string;
  messages: Message[];
  /** Number of incoming messages not yet seen by the user. */
  unreadCount: number;
}
