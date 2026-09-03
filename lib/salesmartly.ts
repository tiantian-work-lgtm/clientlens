import { createHash } from "node:crypto";
import { getRuntimeProviderConfig } from "./provider-config";

interface SaleSmartlyApiResponse<T> {
  code?: number;
  msg?: string;
  data?: T;
}

interface RawCustomer {
  chat_user_id?: string;
  name?: string;
  remark_name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  channel?: number;
  channel_info?: string;
  country?: string;
  city?: string;
  language?: string;
  msg_last_send_time?: number;
}

interface RawMessage {
  chat_user_id?: string;
  sequence_id?: number;
  is_system?: number | string | boolean;
  send_time?: number;
  sender?: string;
  sender_type?: number | string;
  msg_type?: number | string;
  text?: string;
  content?: string | Record<string, unknown>;
  is_withdraw?: number | string | boolean;
}

export interface SaleSmartlyCustomer {
  id: string;
  name: string;
  remark: string;
  email: string;
  phone: string;
  channel: string;
  country: string;
  language: string;
  lastMessageAt: string;
}

function mapSaleSmartlyCustomer(item: RawCustomer): SaleSmartlyCustomer {
  return {
    id: item.chat_user_id as string,
    name: item.name || item.email || item.phone_number || item.phone || "未命名客户",
    remark: item.remark_name || "",
    email: item.email || "",
    phone: item.phone_number || item.phone || "",
    channel: channelNames[item.channel ?? 0] || item.channel_info || `渠道 ${item.channel ?? "未知"}`,
    country: [item.country, item.city].filter(Boolean).join(" · ") || "待识别",
    language: item.language || "",
    lastMessageAt: item.msg_last_send_time ? formatTimestamp(item.msg_last_send_time) : "暂无时间",
  };
}

const channelNames: Record<number, string> = {
  1: "Facebook Messenger", 2: "聊天插件", 3: "Email", 4: "Telegram", 5: "Instagram", 6: "LINE",
  7: "WhatsApp", 8: "Facebook 评论", 9: "Third Party", 10: "Slack", 11: "微信客服", 12: "WhatsApp 个号",
  13: "Instagram 评论", 15: "Telegram 个号", 16: "TikTok 个号", 17: "TikTok 评论", 18: "VKontakte",
  19: "Zalo", 20: "TikTok Business", 21: "TikTok Business 评论", 22: "YouTube",
};

const messageTypeNames: Record<number, string> = { 2: "[图片]", 4: "[文件]", 6: "[视频]", 7: "[邮件]", 12: "[语音]", 22: "[贴纸]", 23: "[地址]", 28: "[通话记录]" };

export function createSaleSmartlySign(token: string, params: Record<string, string>) {
  const sorted = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);
  return createHash("md5").update([token, ...sorted].join("&")).digest("hex");
}

async function saleSmartlyGet<T>(path: string, params: Record<string, string>) {
  const config = await getRuntimeProviderConfig("salesmartly");
  if (!config?.apiKey) throw new Error("请先在系统设置保存 SaleSmartly API Token");
  if (!config.model) throw new Error("请先在系统设置填写 SaleSmartly Project ID");
  const requestParams = { ...params, project_id: config.model };
  const sign = createSaleSmartlySign(config.apiKey, requestParams);
  const query = new URLSearchParams(requestParams);
  const response = await fetch(`${config.baseUrl || "https://developer.salesmartly.com"}${path}?${query}`, {
    headers: { "external-sign": sign },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as SaleSmartlyApiResponse<T>;
  if (!response.ok || payload.code !== 0) throw new Error(payload.msg || `SaleSmartly 返回 ${response.status}`);
  if (!payload.data) throw new Error("SaleSmartly 未返回数据");
  return payload.data;
}

export async function searchSaleSmartlyCustomers(search: string) {
  const clean = search.trim().slice(0, 100);
  const params: Record<string, string> = { page: "1", page_size: "20" };
  if (clean.includes("@")) params.email = clean;
  else if (/^\+?[\d\s()-]{5,}$/.test(clean)) params.phone = clean.replace(/[\s()-]/g, "");
  else if (/^[a-f\d]{16,}$/i.test(clean)) params.chat_user_id = clean;
  else if (clean) params.name = clean;

  const data = await saleSmartlyGet<{ list?: RawCustomer[]; total?: number }>("/api/v2/get-contact-list", params);
  const customers: SaleSmartlyCustomer[] = (data.list ?? []).filter((item) => item.chat_user_id).map(mapSaleSmartlyCustomer);
  return { customers, total: data.total ?? customers.length };
}

export async function getSaleSmartlyCustomer(chatUserId: string) {
  const data = await saleSmartlyGet<{ list?: RawCustomer[]; total?: number }>("/api/v2/get-contact-list", {
    chat_user_id: chatUserId,
    page: "1",
    page_size: "1",
  });
  const customer = (data.list ?? []).find((item) => item.chat_user_id === chatUserId) || data.list?.[0];
  return customer?.chat_user_id ? mapSaleSmartlyCustomer(customer) : null;
}

export async function getSaleSmartlyConversation(chatUserId: string) {
  const rawMessages: RawMessage[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  let previousPageSignature = "";
  while (rawMessages.length < total) {
    const data = await saleSmartlyGet<{ list?: RawMessage[]; total?: number }>("/api/v2/get-message-list", {
      chat_user_id: chatUserId,
      page: String(page),
      page_size: "100",
      sort_type: "1",
    });
    const pageMessages = data.list ?? [];
    total = typeof data.total === "number" ? data.total : Number.POSITIVE_INFINITY;
    const signature = pageMessages.map((item) => `${item.sequence_id ?? ""}:${item.send_time ?? ""}:${item.sender ?? ""}:${item.text ?? ""}`).join("|");
    if (!pageMessages.length || (page > 1 && signature === previousPageSignature)) break;
    rawMessages.push(...pageMessages);
    previousPageSignature = signature;
    if (pageMessages.length < 100) break;
    page += 1;
  }
  const systemMessageCount = rawMessages.filter((item) => isEnabledFlag(item.is_system)).length;
  const withdrawnMessageCount = rawMessages.filter((item) => isEnabledFlag(item.is_withdraw)).length;
  const messages = rawMessages
    // SaleSmartly 的 is_system=-1 表示机器人消息，应当保留；只有 1 才是系统通知。
    // 部分项目会将 0/1 返回为字符串，因此不能直接用 JavaScript 真值判断。
    .filter((item) => !isEnabledFlag(item.is_withdraw) && !isEnabledFlag(item.is_system) && Number(item.msg_type) !== 8 && item.text?.trim() !== "[系统消息]")
    .sort((left, right) => (left.send_time ?? left.sequence_id ?? 0) - (right.send_time ?? right.sequence_id ?? 0));
  const conversation = messages.map((item) => {
    const role = item.sender === chatUserId || Number(item.sender_type) === 1 ? "Customer" : "Sales";
    const text = extractMessageText(item);
    return `[${formatTimestamp(item.send_time ?? 0)}] ${role}: ${text}`;
  }).join("\n");
  return {
    conversation,
    messageCount: messages.length,
    rawMessageCount: rawMessages.length,
    systemMessageCount,
    withdrawnMessageCount,
    total: Number.isFinite(total) ? total : rawMessages.length,
  };
}

function isEnabledFlag(value: number | string | boolean | undefined) {
  return value === true || value === 1 || value === "1";
}

function extractMessageText(item: RawMessage) {
  const text = typeof item.text === "string" ? item.text.trim() : "";
  if (text) return text;
  if (typeof item.content === "string" && item.content.trim()) return item.content.trim();
  if (item.content && typeof item.content === "object") {
    const contentText = item.content.text;
    if (typeof contentText === "string" && contentText.trim()) return contentText.trim();
  }
  const messageType = Number(item.msg_type ?? 0);
  return messageTypeNames[messageType] || `[消息类型 ${messageType}]`;
}

function formatTimestamp(value: number) {
  if (!value) return "时间未知";
  const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
  return new Date(milliseconds).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

export async function testSaleSmartlyConnection() {
  const data = await saleSmartlyGet<{ total?: number }>("/api/v2/get-contact-list", { page: "1", page_size: "1" });
  return { total: data.total };
}
