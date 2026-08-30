export interface ParsedConversationMessage {
  id: string;
  time: string;
  role: "customer" | "sales" | "unknown";
  label: string;
  content: string;
}

export function parseConversationMessages(conversation: string): ParsedConversationMessage[] {
  const messages: ParsedConversationMessage[] = [];
  for (const rawLine of conversation.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(?:\[([^\]]+)\]\s*)?(Customer|Sales|客户|销售)\s*:\s*(.*)$/i);
    if (match) {
      if (match[3].trim() === "[系统消息]") continue;
      const customer = /^(customer|客户)$/i.test(match[2]);
      messages.push({
        id: `M${String(messages.length + 1).padStart(5, "0")}`,
        time: match[1] || "",
        role: customer ? "customer" : "sales",
        label: customer ? "客户" : "销售",
        content: match[3].trim(),
      });
      continue;
    }
    const previous = messages.at(-1);
    if (previous) previous.content = `${previous.content}\n${line}`.trim();
    else messages.push({ id: "M00001", time: "", role: "unknown", label: "消息", content: line });
  }
  return messages;
}

export function buildNumberedConversationChunks(conversation: string, maxCharacters = 45_000) {
  const messages = parseConversationMessages(conversation);
  const chunks: string[] = [];
  let current = "";
  for (const message of messages) {
    const line = `[${message.id}]${message.time ? ` [${message.time}]` : ""} ${message.label}: ${message.content}`;
    if (current && current.length + line.length + 1 > maxCharacters) {
      chunks.push(current);
      current = line;
    } else {
      current = `${current}${current ? "\n" : ""}${line}`;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [conversation];
}
