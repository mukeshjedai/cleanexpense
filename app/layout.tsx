import type { Metadata } from 'next';
import './globals.css';
import { WorkspaceProvider } from './workspace';
export const metadata: Metadata = { title: 'Statement Studio — Your money, in focus', description: 'Turn bank statements into a clear picture of your spending.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><WorkspaceProvider>{children}</WorkspaceProvider></body></html>; }
