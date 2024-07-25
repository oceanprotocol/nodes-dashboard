import React from 'react'
import { ExpanderComponentProps } from 'react-data-table-component'
import {  NodeData } from '@Types/RowDataType'
import styles from './index.module.css'


const NodeDetails: React.FC<ExpanderComponentProps<NodeData>> = ({ data }) => {
  const keyValuePairs = Object.keys(data).map((key) => {
    const value = data[key as keyof NodeData];
    return { key, value: typeof value === 'object' ? JSON.stringify(value) : value };
  });

  console.log('keyValuePairs', keyValuePairs);

  return (
    <div className={styles.root}>
      {keyValuePairs.map((item) => (
        <div className={styles.item} key={item.key + item.value}>
          <div className={styles.key}>{item.key}</div>
          <div className={styles.value}>{String(item.value)}</div>
        </div>
      ))}
    </div>
  );
};

export default NodeDetails;
