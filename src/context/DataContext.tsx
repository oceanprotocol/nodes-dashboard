import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { NodeData } from '@/shared/types/RowDataType';

export const DataContext = createContext(undefined);

export const DataProvider = ({ children }) => {
  const [data, setData] = useState<NodeData[]>([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://ubuntu@ocean-node3.oceanprotocol.io:8000/nodes');
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
