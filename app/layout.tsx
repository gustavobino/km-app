import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Km+", template: "%s · Km+" },
  description:
    "Registre seus ganhos em 20 segundos e veja quanto sobrou no bolso.",
  applicationName: "Km+",
  appleWebApp: { capable: true, title: "Km+", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${manrope.variable} antialiased`}
    >
      <body className="min-h-dvh bg-bg font-sans text-ink">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
