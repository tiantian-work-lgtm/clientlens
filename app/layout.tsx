import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClientLens · 客户分析台",
  description: "AI-powered customer conversation analysis workspace",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
