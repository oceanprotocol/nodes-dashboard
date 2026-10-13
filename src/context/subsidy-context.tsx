import { SubsidyDetails } from '@/types/subsidy';
import { createContext, ReactNode, useContext, useState } from 'react';

type SubsidyContextType = {
  subsidyDetails: SubsidyDetails | null;
  setSubsidyDetails: (subsidyDetails: SubsidyDetails) => void;
};

const SubsidyContext = createContext<SubsidyContextType | undefined>(undefined);

export const SubsidyProvider = ({ children }: { children: ReactNode }) => {
  const [subsidyDetails, setSubsidyDetails] = useState<SubsidyDetails | null>(null);

  return (
    <SubsidyContext.Provider
      value={{
        subsidyDetails,
        setSubsidyDetails,
      }}
    >
      {children}
    </SubsidyContext.Provider>
  );
};

export const useSubsidyContext = () => {
  const context = useContext(SubsidyContext);
  if (!context) {
    throw new Error('useSubsidyContext must be used within a SubsidyProvider');
  }
  return context;
};
