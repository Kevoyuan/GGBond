import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GGBond",
  description: "A pixel-perfect AI IDE interface for gemini-cli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased drag-region"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
