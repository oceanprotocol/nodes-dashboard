import React from 'react'
import DataTable, { TableColumn } from 'react-data-table-component'

import styles from './index.module.css'
import { customStyles } from './_styles'

import NodeDetails from '../NodeDetails'
import { Data } from './data'
import { DataRowType } from '../../shared/types/RowDataType'
import Link from 'next/link'

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
  const Columns: TableOceanColumn<DataRowType | any>[] = [
    { name: 'Node Id', selector: (row: DataRowType) => row.nodeId },
    { name: 'Network', selector: (row: DataRowType) => row.network },
    { name: 'Block Number', selector: (row: DataRowType) => row.blockNumber },
    { name: 'IP', selector: (row: DataRowType) => row.ipAddress },
    { name: 'Location', selector: (row: DataRowType) => row.location },
    {
      name: 'Uptime',
      selector: (row: DataRowType) => row.uptime
    },
    { name: '', selector: (row: DataRowType) => <ViewMore id={row.nodeId} /> }
  ]

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Ocean Nodes Dashboard</h1>
      <DataTable
        data={Data}
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
