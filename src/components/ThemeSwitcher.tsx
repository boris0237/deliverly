import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/store';

const ThemeSwitcher = () => {
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="flex items-center gap-2 text-foreground/70 hover:text-foreground hover:bg-white/10"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="hidden md:inline text-sm">{isDark ? 'Light' : 'Dark'}</span>
    </Button>
  );
};

export default ThemeSwitcher;
