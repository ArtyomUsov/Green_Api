import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkAccount,
  deleteNotification,
  getContacts,
  getStateInstance,
  receiveNotification,
  sendMessage,
  type GreenApiCredentials,
} from "../api/greenApi";
import type { Chat, Message } from "../types";

/** Interval between polling cycles, ms. */
const POLL_INTERVAL_MS = 5000;

/** Key prefix for persisting chats per instance in localStorage. */
const STORAGE_PREFIX = "green-api-chats";

interface PersistedChatState {
  chats: Chat[];
  activeChatId: string | null;
}

function storageKey(creds: GreenApiCredentials): string {
  return `${STORAGE_PREFIX}:${creds.idInstance}`;
}

function loadState(creds: GreenApiCredentials): PersistedChatState {
  try {
    const raw = localStorage.getItem(storageKey(creds));
    if (!raw) return { chats: [], activeChatId: null };
    const parsed = JSON.parse(raw) as PersistedChatState;
    if (!Array.isArray(parsed.chats)) return { chats: [], activeChatId: null };
    return {
      // Migration for chats stored before unreadCount was introduced
      chats: parsed.chats.map((c) => ({
        ...c,
        unreadCount: typeof c.unreadCount === "number" ? c.unreadCount : 0,
      })),
      activeChatId:
        typeof parsed.activeChatId === "string" ? parsed.activeChatId : null,
    };
  } catch {
    return { chats: [], activeChatId: null };
  }
}

/** Normalize a phone number: keep digits only, convert leading 8 to 7 (RF). */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  // RF: 11 digits starting with 7; RB: 12 digits starting with 375
  if (/^7\d{10}$/.test(digits) || /^375\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

/**
 * Chat store: chats list, active chat, message sending
 * and the ReceiveNotification/DeleteNotification polling loop.
 * Chats are persisted to localStorage per instance, so a page reload
 * keeps the chat list and history.
 * Mounted only while logged in, so credentials are always present.
 */
export function useChatStore(creds: GreenApiCredentials) {
  const initial = useMemo(() => loadState(creds), [creds]);
  const [chats, setChats] = useState<Chat[]>(initial.chats);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    initial.activeChatId
  );
  const [creatingChat, setCreatingChat] = useState(false);
  const [createChatError, setCreateChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const credsRef = useRef<GreenApiCredentials>(creds);
  credsRef.current = creds;

  // Latest active chat id for the unread counter inside setChats callbacks
  const activeChatIdRef = useRef<string | null>(activeChatId);
  activeChatIdRef.current = activeChatId;

  /** Select a chat and reset its unread counter. */
  const selectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    setChats((prev) =>
      prev.map((c) => (c.chatId === chatId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const activeChat = chats.find((c) => c.chatId === activeChatId) ?? null;

  // Persist chats on every change
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(creds),
        JSON.stringify({ chats, activeChatId } satisfies PersistedChatState)
      );
    } catch {
      // Ignore quota errors — the app keeps working in memory
    }
  }, [creds, chats, activeChatId]);

  const addMessage = useCallback(
    (chatId: string, message: Message, title?: string) => {
      setChats((prev) => {
        const exists = prev.some((c) => c.chatId === chatId);
        // Skip duplicates (a message may arrive both from polling and storage)
        if (
          exists &&
          prev
            .find((c) => c.chatId === chatId)!
            .messages.some((m) => m.id === message.id)
        ) {
          return prev;
        }
        const next = exists
          ? prev.map((c) => {
              // Upgrade a bare phone/chatId title with the real sender name
              // once it arrives in a notification
              const betterTitle =
                title && (c.title === c.chatId || c.title === c.phone)
                  ? title
                  : c.title;
              // Count unread incoming messages for chats that are not open
              const unreadBump =
                !message.outgoing && chatId !== activeChatIdRef.current ? 1 : 0;
              return {
                ...c,
                title: betterTitle,
                messages: [...c.messages, message],
                unreadCount: c.unreadCount + unreadBump,
              };
            })
          : [
              ...prev,
              {
                chatId,
                title: title ?? chatId,
                phone: "",
                messages: [message],
                unreadCount: 0,
              },
            ];
        // Keep the most recently updated chat on top
        return [...next].sort(
          (a, b) =>
            (b.messages.at(-1)?.timestamp ?? 0) -
            (a.messages.at(-1)?.timestamp ?? 0)
        );
      });
    },
    []
  );

  const updateMessage = useCallback(
    (chatId: string, id: string, patch: Partial<Message>) => {
      setChats((prev) =>
        prev.map((c) =>
          c.chatId === chatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === id ? { ...m, ...patch } : m
                ),
              }
            : c
        )
      );
    },
    []
  );

  /** Create (or open) a chat for a phone number via checkAccount. */
  const createChatByPhone = useCallback(async (phoneInput: string) => {
    setCreateChatError(null);
    const phone = normalizePhone(phoneInput);
    if (!phone) {
      setCreateChatError(
        "Введите номер в международном формате: РФ — 11 цифр (7…), РБ — 12 цифр (375…)"
      );
      return;
    }

    setCreatingChat(true);
    try {
      const result = await checkAccount(credsRef.current, phone);
      if (!result.exist || !result.chatId) {
        setCreateChatError("На этом номере нет аккаунта MAX");
        return;
      }
      // Best-effort: resolve the contact display name via getContacts.
      // The API fills names only for accounts with prior incoming
      // correspondence, so fall back to the phone number.
      let title = phone;
      try {
        const contacts = await getContacts(credsRef.current);
        const contact = contacts.find((c) => c.chatId === result.chatId);
        if (contact && (contact.contactName || contact.name)) {
          title = contact.contactName || contact.name;
        }
      } catch {
        // Name lookup is optional — keep the phone number as the title
      }
      setChats((prev) => {
        if (prev.some((c) => c.chatId === result.chatId)) return prev;
        return [
          {
            chatId: result.chatId,
            title,
            phone,
            messages: [],
            unreadCount: 0,
          },
          ...prev,
        ];
      });
      setActiveChatId(result.chatId);
    } catch (err) {
      setCreateChatError(
        err instanceof Error
          ? `Не удалось создать чат: ${err.message}`
          : "Не удалось создать чат"
      );
    } finally {
      setCreatingChat(false);
    }
  }, []);

  /** Send a text message to the active chat (optimistic). */
  const sendTextMessage = useCallback(
    async (chatId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const tempId = `local-${Date.now()}`;
      setSendError(null);
      addMessage(chatId, {
        id: tempId,
        text: trimmed,
        timestamp: Math.floor(Date.now() / 1000),
        outgoing: true,
        status: "sending",
      });

      setSending(true);
      try {
        const result = await sendMessage(credsRef.current, chatId, trimmed);
        updateMessage(chatId, tempId, { id: result.idMessage, status: "sent" });
      } catch (err) {
        updateMessage(chatId, tempId, { status: "failed" });
        setSendError(
          err instanceof Error
            ? `Не удалось отправить: ${err.message}`
            : "Не удалось отправить сообщение"
        );
      } finally {
        setSending(false);
      }
    },
    [addMessage, updateMessage]
  );

  /**
   * Polling loop: ReceiveNotification → process incoming messages,
   * messages sent from other devices and outgoing message statuses →
   * DeleteNotification. Every received notification is confirmed so
   * the queue keeps moving.
   */
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        // Drain the queue: keep receiving while notifications are available
        for (let i = 0; i < 10 && !stopped; i++) {
          const received = await receiveNotification(creds);
          if (!received) break;

          const { body } = received;
          const chatId = body.senderData?.chatId;

          if (
            body.typeWebhook === "incomingMessageReceived" &&
            body.messageData?.typeMessage === "textMessage" &&
            body.messageData.textMessageData?.textMessage &&
            chatId
          ) {
            addMessage(
              chatId,
              {
                id: body.idMessage,
                text: body.messageData.textMessageData.textMessage,
                timestamp: body.timestamp,
                outgoing: false,
                status: "sent",
              },
              body.senderData?.senderName ||
                body.senderData?.chatName ||
                undefined
            );
          } else if (
            // A message sent from another device/phone — show it too
            // (own messages sent from this app are deduplicated by id)
            body.typeWebhook === "outgoingMessageReceived" &&
            body.messageData?.typeMessage === "textMessage" &&
            body.messageData.textMessageData?.textMessage &&
            chatId
          ) {
            addMessage(chatId, {
              id: body.idMessage,
              text: body.messageData.textMessageData.textMessage,
              timestamp: body.timestamp,
              outgoing: true,
              status: "sent",
            });
          } else if (chatId && body.idMessage) {
            // Delivery/read statuses: outgoingMessageStatus carries
            // status: sent|delivered|read; older variants carry
            // outgoingMessageDelivered / outgoingMessageRead per message.
            let status: Message["status"] | null = null;
            if (body.typeWebhook === "outgoingMessageStatus") {
              const s = (body as { status?: string }).status;
              if (s === "delivered" || s === "read") status = s;
            } else if (body.typeWebhook === "outgoingMessageDelivered") {
              status = "delivered";
            } else if (body.typeWebhook === "outgoingMessageRead") {
              status = "read";
            }
            if (status) {
              updateMessage(chatId, body.idMessage, { status });
            }
          }

          // Confirm the notification regardless of type (statuses etc.)
          await deleteNotification(creds, received.receiptId);
        }
      } catch {
        // Network/API errors are ignored here; the next cycle will retry
      } finally {
        if (!stopped) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    }

    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [creds, addMessage, updateMessage]);

  /**
   * Instance status shown in the sidebar: stateInstance from the
   * lightweight getStateInstance method. Retried with backoff when the
   * API answers 429 (Too Many Requests) so the status does not get
   * stuck on "Проверка статуса…".
   */
  const [instanceStatus, setInstanceStatus] = useState<{
    stateInstance?: string;
  }>({});
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout>;

    async function loadStatus() {
      try {
        const { stateInstance } = await getStateInstance(creds);
        if (!cancelled) setInstanceStatus({ stateInstance });
      } catch (err) {
        // Retry a few times (429 rate limit / network hiccups),
        // then give up — the sidebar just hides the status
        if (cancelled || attempt >= 5) return;
        attempt += 1;
        retryTimer = setTimeout(loadStatus, Math.min(5000 * attempt, 30000));
      }
    }

    // Delay the first request: at mount the polling loop fires its own
    // burst of receiveNotification calls, and an extra request right away
    // often hits the instance rate limit (429)
    const initialTimer = setTimeout(loadStatus, 3000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearTimeout(retryTimer);
    };
  }, [creds]);

  return {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId: selectChat,
    createChatByPhone,
    creatingChat,
    createChatError,
    sendTextMessage,
    sending,
    sendError,
    instanceStatus,
  };
}
