import "./globals.css";

export const metadata = {
  title: "Chinese Review",
  description: "Chinese Class Review Web Application",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function Root({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
