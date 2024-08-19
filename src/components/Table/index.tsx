import React, { useMemo, useState } from 'react';
import { DataGrid, GridColDef, GridToolbar, GridValueGetter } from '@mui/x-data-grid';
import styles from './index.module.css';
import NodeDetails from '../NodeDetails';
import { NodeData } from '../../shared/types/RowDataType';
import Link from 'next/link';
import { useDataContext } from '@/context/DataContext';
import { IndexerType } from '@/shared/types/dataTypes';

const ViewMore = ({ id }: { id: string }) => {
  return (
    <Link href={`/node/${id}`} className={styles.download}>
      View More
    </Link>
  );
};

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

export default function Table() {
  const { data, loading, error } = useDataContext();
  const [search, setSearch] = useState('');

  data.sort((a, b) => b.uptime - a.uptime);

  const dataWithIndex = useMemo(() => {
    return data.map((item, index) => ({ ...item, id: index + 1 }));
  }, [data]);

  const filteredData = useMemo(() => {
    return dataWithIndex.filter(item =>
      Object.values(item).some(value =>
        String(value).toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, dataWithIndex]);

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'Index', width: 90 },
    {
      field: 'nodeId',
      headerName: 'Node Id',
      width: 150
    },
    { field: 'address', headerName: 'Address', width: 200 },
    {
      field: 'network',
      headerName: 'Network',
      width: 150
    },
    {
      field: 'ip',
      headerName: 'IP',
      width: 130
    },
    {
      field: 'dns',
      headerName: 'DNS',
      width: 130,
      valueGetter: (row: NodeData) =>
        `${row?.ipAndDns?.dns || ''}`,
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 180,
      valueGetter: (row: NodeData) =>
        `${row?.location?.city || ''} ${row?.location?.country || ''}`,
    },
    {
      field: 'uptime',
      headerName: 'Week Uptime',
      width: 150,
      valueGetter: (row: NodeData) =>
        formatUptime(row?.uptime),
    }
    // {
    //   field: 'viewMore',
    //   headerName: '',
    //   width: 130,
    //   renderCell: (row: NodeData) => <ViewMore id={row?.id} />,
    //   sortable: false,
    // },
  ];

  return (
    <div className={styles.root}>
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className={styles.search}
      />
      <div style={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredData}
          columns={columns}
          slots={{ toolbar: GridToolbar }}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 10
              }
            }
          }}
          pageSizeOptions={[10]}
          loading={loading}
          getRowHeight={() => 'auto'}
        />
      </div>
    </div>
  );
}
