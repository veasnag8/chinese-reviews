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
  params,
}: {
  children: React.ReactNode;
  params: {
    [key: string]: string;
  };
}) {
  return <html lang="en">{children}</html>;
}