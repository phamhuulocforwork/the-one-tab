/**
 * Initialize dark mode based on browser's prefers-color-scheme setting
 * Applies .dark class to <html> element when dark mode is preferred
 */
export function initDarkMode(): void {
  // Check if matchMedia is available (should be available in all modern browsers)
  if (typeof window === 'undefined' || !window.matchMedia) {
    return;
  }

  // Function to update dark mode class based on media query
  const updateDarkMode = (matches: boolean) => {
    if (matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Check initial state
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  updateDarkMode(darkModeQuery.matches);

  // Listen for changes in color scheme preference
  // Modern browsers support addEventListener
  if (darkModeQuery.addEventListener) {
    darkModeQuery.addEventListener('change', (e) => {
      updateDarkMode(e.matches);
    });
  } else {
    // Fallback for older browsers (deprecated but still supported)
    darkModeQuery.addListener((e: MediaQueryListEvent) => {
      updateDarkMode(e.matches);
    });
  }
}
