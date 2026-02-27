import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Athletiq",
  description: "Athlete management platform for organizations",
  icons: {
    icon: "/logo/favicon.png",
    apple: "/logo/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
