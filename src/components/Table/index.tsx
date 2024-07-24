import React, { useContext } from 'react'
import DataTable, { TableColumn } from 'react-data-table-component'

import styles from './index.module.css'
import { customStyles } from './_styles'

import NodeDetails from '../NodeDetails'
import { Data } from './data'
import {  NodeData } from '../../shared/types/RowDataType'
import Link from 'next/link'
import { DataContext } from '@/context/DataContext'

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

export default function Tsable() {
  const { data, loading, error } = useContext(DataContext);
  console.log('Tsable data: ', data)

  const Columns: TableOceanColumn<NodeData | any>[] = [
    { name: 'Node Id', selector: (row: NodeData) => row.id },
    { name: 'Network', selector: (row: NodeData) => row.indexer?.[0]?.network },
    { name: 'Block Number', selector: (row: NodeData) => row.indexer?.[0]?.block },
    { name: 'IP', selector: (row: NodeData) => row.ipAndDns.ip },
    { name: 'Location', selector: (row: NodeData) => row.location.city },
    {
      name: 'Uptime',
      selector: (row: NodeData) => row.uptime
    },
    { name: '', selector: (row: NodeData) => <ViewMore id={row.id} /> }
  ]

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Ocean Nodes Dashboard</h1>
      <DataTable
        data={data}
        columns={Columns}
        paginationPerPage={5}
        defaultSortAsc
        // expandableRows
        // expandableRowsComponent={NodeDetails}
        theme="custom"
        customStyles={customStyles}
      />
    </div>
  )
}
