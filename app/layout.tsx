import "./globals.css";

export const metadata = {
  title: "Chinese Review",
  description: "Chinese Class Review Web Application",
  icons: {
    favicon: "/favicon.ico",
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
