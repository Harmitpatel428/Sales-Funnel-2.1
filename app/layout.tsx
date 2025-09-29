import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LeadProvider } from "./context/LeadContext";
import { PasswordProvider } from "./context/PasswordContext";
import { ColumnProvider } from "./context/ColumnContext";
import { HeaderProvider } from "./context/HeaderContext";
import { NavigationProvider } from "./context/NavigationContext";
import NavigationWrapper from "./components/NavigationWrapper";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Enterprise Lead Management System",
  description: "Professional Enterprise Lead Management & CRM System",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="gu">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <LeadProvider>
          <PasswordProvider>
            <ColumnProvider>
              <HeaderProvider>
                <NavigationProvider>
                  <div className="flex flex-col h-screen">
                    <NavigationWrapper />
                    <main className="flex-1 overflow-y-auto p-0">
                      {children}
                    </main>
                  </div>
                </NavigationProvider>
              </HeaderProvider>
            </ColumnProvider>
          </PasswordProvider>
        </LeadProvider>
      </body>
    </html>
  );
}
