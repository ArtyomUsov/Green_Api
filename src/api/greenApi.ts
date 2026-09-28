/**
 * GREEN-API client for MAX messenger.
 *
 * Docs:
 * - Sending:    https://green-api.com/v3/docs/api/sending/SendMessage/
 * - Receiving:  https://green-api.com/v3/docs/api/receiving/technology-http-api/
 *
 * Every method is called as:
 *   {apiUrl}/waInstance{idInstance}/{methodName}/{apiTokenInstance}
 */

export interface GreenApiCredentials {
  /** Base API URL, e.g. https://api.green-api.com */
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

/** Error thrown for any non-2xx GREEN-API response. */
export class GreenApiError extends Error {
  constructor(public status: number, public method: string, message: string) {
    super(`GREEN-API ${method} [${status}]: ${message}`);
    this.name = "GreenApiError";
  }
}

/** Account settings returned by getSettings (subset used by the app). */
export interface AccountSettings {
  wid?: string;
  stateInstance?: string;
  [key: string]: unknown;
}

/** Result of sendMessage. */
export interface SendMessageResult {
  idMessage: string;
}

/**
 * Incoming notification received by receiveNotification.
 * The body differs per type; only fields used by the app are typed.
 */
export interface Notification {
  typeWebhook: string;
  instanceId: number;
  timestamp: number;
  idMessage: string;
  senderData?: {
    chatId: string;
    chatName?: string;
    sender?: string;
    senderId?: string;
    senderName?: string;
    senderPhoneNumber?: number;
    [key: string]: unknown;
  };
  messageData?: {
    typeMessage: string;
    textMessageData?: {
      textMessage: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Response of receiveNotification: receipt id + notification body. */
export interface ReceivedNotification {
  receiptId: number;
  body: Notification;
}

/** Response of checkAccount. */
export interface CheckAccountResult {
  exist: boolean;
  chatId: string;
  fromCache?: boolean;
  [key: string]: unknown;
}

/** Contact entry returned by getContacts. */
export interface Contact {
  chatId: string;
  /** Empty when the contact never sent a message to this account. */
  name: string;
  contactName: string;
  type: string;
  phoneNumber: number;
}

const DEFAULT_API_URL = "https://api.green-api.com";

function buildUrl(
  creds: GreenApiCredentials,
  method: string,
  pathSuffix = ""
): string {
  const base = creds.apiUrl.replace(/\/+$/, "") || DEFAULT_API_URL;
  const suffix = pathSuffix ? `/${pathSuffix}` : "";
  // All methods share the shape:
  // {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}[/{extraParam}]
  return `${base}/waInstance${creds.idInstance}/${method}/${creds.apiTokenInstance}${suffix}`;
}

async function request<T>(
  creds: GreenApiCredentials,
  method: string,
  init?: RequestInit,
  pathSuffix?: string | number
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      buildUrl(
        creds,
        method,
        pathSuffix === undefined ? "" : String(pathSuffix)
      ),
      init
    );
  } catch (e) {
    throw new GreenApiError(
      0,
      method,
      `Network error: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const raw = await response.text();
  let body: unknown = undefined;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  if (!response.ok) {
    let message = response.statusText;
    if (body && typeof body === "object" && "error" in body) {
      message = String((body as { error: unknown }).error);
    } else if (typeof body === "string" && body) {
      message = body;
    }
    throw new GreenApiError(response.status, method, message);
  }

  return body as T;
}

/** Check credentials / fetch instance settings. Throws GreenApiError when invalid. */
export function getSettings(
  creds: GreenApiCredentials
): Promise<AccountSettings> {
  return request<AccountSettings>(creds, "getSettings", { method: "GET" });
}

/**
 * Lightweight instance state check (authorized / notAuthorized / ...).
 * Unlike getSettings it is not heavily rate-limited, so it is used
 * for the sidebar status indicator.
 */
export function getStateInstance(
  creds: GreenApiCredentials
): Promise<{ stateInstance: string }> {
  return request<{ stateInstance: string }>(creds, "getStateInstance", {
    method: "GET",
  });
}

/**
 * Check that a MAX account exists for a phone number and get its chatId.
 * Phone must be in international format: 11 digits (RF, starts with 7)
 * or 12 digits (RB, starts with 375).
 */
export function checkAccount(
  creds: GreenApiCredentials,
  phoneNumber: string
): Promise<CheckAccountResult> {
  return request<CheckAccountResult>(creds, "checkAccount", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: Number(phoneNumber) }),
  });
}

/**
 * Get the list of contacts (accounts that interacted with this instance).
 * Used to resolve display names for chats created via checkAccount.
 */
export function getContacts(creds: GreenApiCredentials): Promise<Contact[]> {
  return request<Contact[]>(creds, "getContacts", { method: "GET" });
}

/**
 * Send a text message to a chat.
 * @param chatId  Chat identifier (see https://green-api.com/v3/docs/api/chat-id/)
 * @param message Message text (up to 4000 characters, UTF-8)
 */
export function sendMessage(
  creds: GreenApiCredentials,
  chatId: string,
  message: string
): Promise<SendMessageResult> {
  return request<SendMessageResult>(creds, "sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
}

/**
 * Receive one incoming notification from the queue (or null when empty).
 * Notifications must be confirmed with deleteNotification.
 */
export function receiveNotification(
  creds: GreenApiCredentials
): Promise<ReceivedNotification | null> {
  return request<ReceivedNotification | null>(creds, "receiveNotification", {
    method: "GET",
  });
}

/**
 * Confirm that a notification has been processed so it is removed from the queue.
 * The receipt id goes after the token:
 * .../deleteNotification/{apiTokenInstance}/{receiptId}
 */
export function deleteNotification(
  creds: GreenApiCredentials,
  receiptId: number
): Promise<{ result: boolean }> {
  return request<{ result: boolean }>(
    creds,
    "deleteNotification",
    { method: "DELETE" },
    String(receiptId)
  );
}
