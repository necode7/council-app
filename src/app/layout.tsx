import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import PostHogProvider from "@/components/PostHogProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Council — Your AI Advisory Board",
  description:
    "5 AI advisors debate your decisions from every angle. Catch blind spots. Get structured verdicts. Make better calls.",
  openGraph: {
    title: "Council — Your AI Advisory Board",
    description:
      "5 AI advisors debate your decisions from every angle. Catch blind spots. Get structured verdicts. Make better calls.",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Council" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Council — Your AI Advisory Board",
    description: "5 AI advisors debate your decisions from every angle.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛</text></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#07060d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body>
        <PostHogProvider>
          {children}
          <Providers />
        </PostHogProvider>
      </body>
    </html>
  );
}
