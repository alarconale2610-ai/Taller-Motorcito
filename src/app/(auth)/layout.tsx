import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { PublicThemeLoader } from '@/components/theme/PublicThemeLoader';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <PublicThemeLoader />
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4">
        {children}
      </div>
    </ThemeProvider>
  );
}