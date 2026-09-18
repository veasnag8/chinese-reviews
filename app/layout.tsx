import "./globals.css";
import { QuizNotificationToaster } from "@/components/quiz-notification-toaster";

export const metadata = {
  title: "Chinese Review",
  description: "Chinese Class Review Web Application",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  themeColor: "#b91c1c",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chinese Review",
  },
};

export default function Root({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#b91c1c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Chinese Review" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <QuizNotificationToaster />
      </body>
    </html>
  );
}
