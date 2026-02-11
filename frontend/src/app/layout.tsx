import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reminder App',
  description: 'Context-aware location-based reminders',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
