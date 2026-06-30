import { createContext, useContext } from 'react';

type InferenceContextType = {};

const InferenceContext = createContext<InferenceContextType | undefined>(undefined);

export const InferenceProvider = ({ children }: { children: React.ReactNode }) => {
  return <InferenceContext.Provider value={{}}>{children}</InferenceContext.Provider>;
};

export const useInferenceContext = () => {
  const context = useContext(InferenceContext);
  if (!context) {
    throw new Error('useInferenceContext must be used within a InferenceProvider');
  }
  return context;
};
