import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Funnel Health Dashboard',
  description:
    'Daily snapshot of Stem Player funnel health: Instagram + TikTok engagement, Mailchimp audience breakdown, and inferred Kano-vs-Stemplayer split.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
