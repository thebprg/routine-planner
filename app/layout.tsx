import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthClient from "./AuthClient";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cal — Tasks & Habits",
  description: "Your schedule, tasks, and habits — all in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased w-full h-full min-h-screen m-0 p-0`}>
        <AuthClient>{children}</AuthClient>
      </body>
    </html>
  );
}
