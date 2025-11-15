import { getApiRoute } from '@/config';
import { EnsProfile } from '@/types/profile';
import { useAppKitAccount } from '@reown/appkit/react';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

type ProfileContextType = {
  ensName: string | undefined;
  ensAddress: string | undefined;
  ensProfile: EnsProfile | undefined;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const account = useAppKitAccount();

  const [ensAddress, setEnsAddress] = useState<ProfileContextType['ensAddress']>(undefined);
  const [ensName, setEnsName] = useState<ProfileContextType['ensName']>(undefined);
  const [ensProfile, setEnsProfile] = useState<ProfileContextType['ensProfile']>(undefined);

  const fetchEnsAddress = useCallback(async (accountId: string) => {
    if (!accountId || accountId === '' || !accountId.includes('.')) {
      return;
    }
    try {
      const response = await axios.get(`${getApiRoute('ensAddress')}?name=${accountId}`);
      if (response.data?.address) {
        setEnsAddress(response.data.address);
      }
    } catch (error) {
      console.error('Error fetching ENS address:', error);
    }
  }, []);

  const fetchEnsName = useCallback(async (accountId: string) => {
    if (!accountId || accountId === '') {
      return;
    }
    try {
      const response = await axios.get(`${getApiRoute('ensName')}?accountId=${accountId}`);
      if (response.data?.name) {
        setEnsName(response.data.name);
      }
    } catch (error) {
      console.error('Error fetching ENS name:', error);
    }
  }, []);

  const fetchEnsProfile = useCallback(async (accountId: string) => {
    if (!accountId || accountId === '') {
      return;
    }
    try {
      const response = await axios.get(`${getApiRoute('ensProfile')}?address=${accountId}`);
      if (response.data?.profile) {
        setEnsProfile(response.data.profile);
      }
    } catch (error) {
      console.error('Error fetching ENS profile:', error);
    }
  }, []);

  useEffect(() => {
    if (account.status === 'connected' && account.address) {
      fetchEnsAddress(account.address);
      fetchEnsName(account.address);
      fetchEnsProfile(account.address);
    } else {
      setEnsAddress(undefined);
      setEnsName(undefined);
      setEnsProfile(undefined);
    }
  }, [account.address, account.status, fetchEnsAddress, fetchEnsName, fetchEnsProfile]);

  return (
    <ProfileContext.Provider
      value={{
        ensAddress,
        ensName,
        ensProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfileContext = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return context;
};
