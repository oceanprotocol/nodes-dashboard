import { useOceanAccount } from '@/lib/use-ocean-account';
import { SubsidyDetails } from '@/types/subsidy';
import { createContext, ReactNode, useContext, useState } from 'react';

type SubsidyContextType = {
  /** Only the connected wallet's details. */
  subsidyDetails: SubsidyDetails | null;
  setSubsidyDetails: (subsidyDetails: SubsidyDetails) => void;
};

const SubsidyContext = createContext<SubsidyContextType | undefined>(undefined);

export const SubsidyProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useOceanAccount();
  const [subsidyDetails, setSubsidyDetails] = useState<SubsidyDetails | null>(null);
  const isConnectedWallet =
    !!subsidyDetails && subsidyDetails.walletAddress.toLowerCase() === account.address?.toLowerCase();

  return (
    <SubsidyContext.Provider
      value={{
        subsidyDetails: isConnectedWallet ? subsidyDetails : null,
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
