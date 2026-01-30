import type { Metadata } from "next";
import { Tomorrow } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/trpc/client"; // 👈 ADD THIS

const tomorrow = Tomorrow({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-tomorrow",
});

export const metadata: Metadata = {
  title: "Paper Ai",
  description: "Paper ai pentesting app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${tomorrow.className} antialiased bg-black`}>
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}
