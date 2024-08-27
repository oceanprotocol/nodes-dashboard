import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import axios from 'axios';
import { NodeData } from '@/shared/types/RowDataType';

// Define the shape of your context data
interface DataContextType {
  data: NodeData[];
  loading: boolean;
  error: any;
}

interface DataProviderProps {
  children: ReactNode;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);
 
export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [data, setData] = useState<NodeData[]>([])
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('https://incentive-backend.oceanprotocol.com/nodes');
        let sanitizedData: NodeData[] = []
        for (let index = 0; index < response.data.length; index++) {
            const element = response.data[index];
            sanitizedData.push(element._source)
        }
        setData(sanitizedData);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <DataContext.Provider value={{ data, loading, error }}>
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};
