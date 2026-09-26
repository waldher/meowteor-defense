import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meowteor Defense — Save Pawlenet Earth",
  description:
    "A giant cat. One tiny planet. Swat asteroids, chain combos, and save Pawlenet Earth in this 3D arcade game.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
