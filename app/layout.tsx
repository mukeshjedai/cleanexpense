import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Statement Studio — Your money, in focus', description: 'Turn bank statements into a clear picture of your spending.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
