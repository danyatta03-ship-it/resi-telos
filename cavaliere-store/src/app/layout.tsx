import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Bungee, Permanent_Marker } from "next/font/google";
import "./globals.css";
import InstagramButton from "@/components/InstagramButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bungee = Bungee({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const marker = Permanent_Marker({
  variable: "--font-tag",
  weight: "400",
  subsets: ["latin"],
});

const siteUrl = "https://cavaliere.store";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cavaliere.store — Cappellini fatti a mano, su misura",
    template: "%s · Cavaliere.store",
  },
  description:
    "Crea il tuo cappellino unico, realizzato completamente a mano. Ricami, patch e stampe custom. Streetwear premium, artigianalità italiana.",
  keywords: [
    "cappellini custom",
    "cappelli su misura",
    "ricamo cappello",
    "streetwear",
    "cavaliere store",
  ],
  authors: [{ name: "Cavaliere.store" }],
  applicationName: "Cavaliere.store",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: siteUrl,
    siteName: "Cavaliere.store",
    title: "Cavaliere.store — Cappellini fatti a mano, su misura",
    description:
      "Crea il tuo cappellino unico, realizzato completamente a mano.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cavaliere.store — Cappellini fatti a mano, su misura",
    description:
      "Crea il tuo cappellino unico, realizzato completamente a mano.",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`dark ${geistSans.variable} ${bungee.variable} ${marker.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[--color-bg] text-[--color-fg]">
        {children}
        <InstagramButton />
      </body>
    </html>
  );
}
