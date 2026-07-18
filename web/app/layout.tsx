import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Premium Neon Snake",
    template: "%s | Premium Neon Snake",
  },
  description:
    "The premium neon Snake desktop game, rebuilt as a browser-native arcade experience.",
  openGraph: {
    title: "Premium Neon Snake",
    description: "Outrun the grid in a browser-native neon arcade.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
