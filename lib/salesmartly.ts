import { createHash } from "node:crypto";
import { getRuntimeProviderConfig } from "./provider-config";

interface SaleSmartlyResponse {
  code?: number;
  msg?: string;
  data?: { total?: number };
}

export function createSaleSmartlySign(token: string, params: Record<string, string>) {
  const sorted = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);
  return createHash("md5").update([token, ...sorted].join("&")).digest("hex");
}

export async function testSaleSmartlyConnection() {
  const config = await getRuntimeProviderConfig("salesmartly");
  if (!config?.apiKey) throw new Error("尚未保存 API Token");
  if (!config.model) throw new Error("尚未填写 Project ID");

  const params = { page: "1", page_size: "1", project_id: config.model };
  const sign = createSaleSmartlySign(config.apiKey, params);
  const query = new URLSearchParams(params);
  const response = await fetch(`${config.baseUrl || "https://developer.salesmartly.com"}/api/v2/get-contact-list?${query}`, {
    headers: { "external-sign": sign },
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({})) as SaleSmartlyResponse;
  if (!response.ok || data.code !== 0) throw new Error(data.msg || `SaleSmartly 返回 ${response.status}`);
  return { total: data.data?.total };
}
