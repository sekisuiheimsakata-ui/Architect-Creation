import React, { createContext, useContext } from 'react';
import type { AppState, Action } from '../types';

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within a AppContext.Provider');
  }
  return context;
};

export default AppContext;