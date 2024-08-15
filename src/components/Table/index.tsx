import React from 'react'
import DataTable, { TableColumn } from 'react-data-table-component'
import styles from './index.module.css'
import { customStyles } from './_styles'
import NodeDetails from '../NodeDetails'
import {  NodeData } from '../../shared/types/RowDataType'
import Link from 'next/link'
import {  useDataContext } from '@/context/DataContext'
import { IndexerType } from '@/shared/types/dataTypes'

export interface TableOceanColumn<T> extends TableColumn<T> {
  selector?: (row: T) => any
}

const ViewMore = ({ id }: { id: string }) => {
  return (
    <Link href={`/node/${id}`} className={styles.download}>
      View More
    </Link>
  )
}

const getAllNetworks = (indexers: IndexerType[]): string => {
  return indexers.map(indexer => indexer.network).join(', ');
};

export const formatUptime = (uptimeInSeconds: number): string => {
  const days = Math.floor(uptimeInSeconds / (3600 * 24));
  const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60);

  const dayStr = days > 0 ? `${days} day${days > 1 ? 's' : ''} ` : '';
  const hourStr = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ` : '';
  const minuteStr = minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''}` : '';

  return `${dayStr}${hourStr}${minuteStr}`.trim();
};
// const getAllBlocks = (indexers: IndexerType[]): string => {
//   return indexers.map(indexer => indexer.block).join(', ');
// };

export default function Tsable() {
  const { data, loading, error } = useDataContext()

  data.sort((a, b) => b.uptime - a.uptime);


  const Columns: TableOceanColumn<NodeData | any>[] = [
    { name: 'Node Id', selector: (row: NodeData) => row?.id },
    { name: 'Address', selector: (row: NodeData) => row?.address },
    { name: 'Network', selector: (row: NodeData) => getAllNetworks(row?.indexer || [])},
    // { name: 'Block Number', selector: (row: NodeData) => getAllBlocks(row?.indexer || [])},
    { name: 'IP', selector: (row: NodeData) =>  `${row?.ipAndDns?.ip || ''}` },
    { name: 'DNS', selector: (row: NodeData) => `${row?.ipAndDns?.dns || ''}`  },
    { name: 'Location', selector: (row: NodeData) => `${row?.location?.city || ''}  ${row?.location?.country || ''}` },
    {
      name: 'Week Uptime',
      selector: (row: NodeData) => formatUptime(row?.uptime)
    },
    // { name: '', selector: (row: NodeData) => <ViewMore id={row.id} /> }
  ]

  return (
    <div className={styles.root}>
      <DataTable
        data={data}
        columns={Columns}
        pagination={false}
        defaultSortAsc
        expandableRows
        expandableRowsComponent={NodeDetails}
        theme="custom"
        customStyles={customStyles}
      />
    </div>
  )
}
