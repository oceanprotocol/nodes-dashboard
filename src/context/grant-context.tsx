import { GrantDetails } from '@/types/grant';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type GrantContextType = {
  clearGrantSelection: () => void;
  grantDetails: GrantDetails | null;
  setGrantDetails: (grantDetails: GrantDetails) => void;
};

const GrantContext = createContext<GrantContextType | undefined>(undefined);

export const GrantProvider = ({ children }: { children: ReactNode }) => {
  const [grantDetails, setGrantDetails] = useState<GrantDetails | null>(null);

  const clearGrantSelection = useCallback(() => {
    setGrantDetails(null);
  }, []);

  return (
    <GrantContext.Provider
      value={{
        clearGrantSelection,
        grantDetails,
        setGrantDetails,
      }}
    >
      {children}
    </GrantContext.Provider>
  );
};

export const useGrantContext = () => {
  const context = useContext(GrantContext);
  if (!context) {
    throw new Error('useGrantContext must be used within a GrantProvider');
  }
  return context;
};
