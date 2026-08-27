// Theme hook for dark/light mode

import { useEffect } from 'react';
import useUserStore from '../stores/userStore';

export function useTheme() {
  const theme = useUserStore((s) => s.theme);
  const updateSetting = useUserStore((s) => s.updateSetting);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    updateSetting('theme', newTheme);
  };

  return { theme, toggleTheme };
}
