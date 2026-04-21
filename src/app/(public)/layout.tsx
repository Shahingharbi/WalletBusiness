import type { Metadata } from "next";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "aswallet",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">{children}</main>
      <footer className="py-4 text-center">
        <p className="text-xs text-gray-400">
          Propulse par{" "}
          <span className="font-semibold text-gray-500">aswallet</span>
        </p>
      </footer>
    </div>
  );
}
