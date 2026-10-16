import type { Metadata } from 'next';
import NavBar from '@/components/NavBar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clique — Home, Dial, Homies, Mehspace, Circles',
  description: 'Make your Homies. Build your Mehspace. Dial who matters. Find your Circles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-16 md:pb-0">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
