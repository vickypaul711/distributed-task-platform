import "./globals.css";

export const metadata = {
  title: "Task Platform Dashboard",
  description: "Operational dashboard mockup built in Next.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
