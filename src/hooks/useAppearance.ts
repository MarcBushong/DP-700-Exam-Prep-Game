import { useLayoutEffect } from 'react';
import type { Preferences } from '../features/quiz/types';

export function useAppearance(preferences: Preferences) {
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        preferences.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : preferences.theme;
      document.documentElement.dataset.reducedMotion = String(
        preferences.reducedMotion,
      );
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.theme, preferences.reducedMotion]);
}
