import React, { createContext, useContext, ReactNode } from 'react';
import { Theme, lightTheme } from './theme';

interface LovasThemeContextValue {
  theme: Theme;
}

const LovasThemeContext = createContext<LovasThemeContextValue>({
  theme: lightTheme,
});

export function LovasThemeProvider({ children }: { children: ReactNode }) {
  return (
    <LovasThemeContext.Provider value={{ theme: lightTheme }}>
      {children}
    </LovasThemeContext.Provider>
  );
}

export function useLovasTheme(): LovasThemeContextValue {
  return useContext(LovasThemeContext);
}
