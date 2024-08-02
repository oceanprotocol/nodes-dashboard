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

const getAllBlocks = (indexers: IndexerType[]): string => {
  return indexers.map(indexer => indexer.block).join(', ');
};

export default function Tsable() {
  const { data, loading, error } = useDataContext()
  console.log('Tsable data: ', data)

  const Columns: TableOceanColumn<NodeData | any>[] = [
    { name: 'Node Id', selector: (row: NodeData) => row?.id },
    { name: 'Network', selector: (row: NodeData) => getAllNetworks(row?.indexer || [])},
    { name: 'Block Number', selector: (row: NodeData) => getAllBlocks(row?.indexer || [])},
    { name: 'IP', selector: (row: NodeData) => row?.ipAndDns?.ip },
    { name: 'Location', selector: (row: NodeData) => row?.location?.city },
    {
      name: 'Uptime',
      selector: (row: NodeData) => row?.uptime
    },
    // { name: '', selector: (row: NodeData) => <ViewMore id={row.id} /> }
  ]

  return (
    <div className={styles.root}>
      <DataTable
        data={data}
        columns={Columns}
        paginationPerPage={5}
        defaultSortAsc
        expandableRows
        expandableRowsComponent={NodeDetails}
        theme="custom"
        customStyles={customStyles}
      />
    </div>
  )
}
