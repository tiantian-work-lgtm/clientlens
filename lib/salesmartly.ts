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
  is_system?: number;
  send_time?: number;
  sender?: string;
  sender_type?: number;
  msg_type?: number;
  text?: string;
  content?: string;
  is_withdraw?: number;
}

export interface SaleSmartlyCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  channel: string;
  country: string;
  language: string;
  lastMessageAt: string;
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
  const customers: SaleSmartlyCustomer[] = (data.list ?? []).filter((item) => item.chat_user_id).map((item) => ({
    id: item.chat_user_id as string,
    name: item.remark_name || item.name || item.email || item.phone_number || item.phone || "未命名客户",
    email: item.email || "",
    phone: item.phone_number || item.phone || "",
    channel: channelNames[item.channel ?? 0] || item.channel_info || `渠道 ${item.channel ?? "未知"}`,
    country: [item.country, item.city].filter(Boolean).join(" · ") || "待识别",
    language: item.language || "",
    lastMessageAt: item.msg_last_send_time ? formatTimestamp(item.msg_last_send_time) : "暂无时间",
  }));
  return { customers, total: data.total ?? customers.length };
}

export async function getSaleSmartlyConversation(chatUserId: string) {
  const data = await saleSmartlyGet<{ list?: RawMessage[]; total?: number }>("/api/v2/get-message-list", {
    chat_user_id: chatUserId,
    page_size: "100",
    sort_type: "1",
  });
  const messages = (data.list ?? [])
    .filter((item) => !item.is_withdraw && !item.is_system)
    .sort((left, right) => (left.send_time ?? left.sequence_id ?? 0) - (right.send_time ?? right.sequence_id ?? 0));
  const conversation = messages.map((item) => {
    const role = item.sender === chatUserId || item.sender_type === 1 ? "Customer" : "Sales";
    const text = item.text?.trim() || item.content?.trim() || messageTypeNames[item.msg_type ?? 0] || `[消息类型 ${item.msg_type ?? 0}]`;
    return `[${formatTimestamp(item.send_time ?? 0)}] ${role}: ${text}`;
  }).join("\n");
  return { conversation, messageCount: messages.length, total: data.total ?? messages.length };
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
