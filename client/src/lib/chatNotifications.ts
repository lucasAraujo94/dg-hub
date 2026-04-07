export const CHAT_LAST_SEEN_KEY = "dg-chat-last-seen";

export const readLastSeenChatAt = (): number => {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(CHAT_LAST_SEEN_KEY);
  return stored ? Number(stored) || 0 : 0;
};

export const writeLastSeenChatAt = (value: number) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_LAST_SEEN_KEY, value.toString());
};
