import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import InstallPrompt from "../components/InstallPrompt";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata = {
  title: "FileStores",
  description: "Upload and manage your videos, photos, and files",
  manifest: "/manifest.json",
};
export const viewport = {
  themeColor: "#2563eb",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <InstallPrompt />
          <ServiceWorkerRegistration />
        </AuthProvider>
      </body>
    </html>
  );
}