import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GANG — Homies, Mess Space, Dial',
  description: 'Create your character. Build your Mess Space. Dial who matters.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
