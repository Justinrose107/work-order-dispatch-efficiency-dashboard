import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Work Order Dispatch Efficiency Dashboard',
  description: 'Local Excel and CSV analysis for work order dispatch efficiency.',
  openGraph: {
    title: 'Work Order Dispatch Efficiency Dashboard',
    description: 'Local Excel & CSV analysis',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Work Order Dispatch Efficiency Dashboard',
    description: 'Local Excel & CSV analysis',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
