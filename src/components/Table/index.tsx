import React, { useMemo, useState } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import styles from './index.module.css';
import NodeDetails from '../NodeDetails';
import { NodeData } from '../../shared/types/RowDataType';
import Link from 'next/link';
import { useDataContext } from '@/context/DataContext';

const ViewMore = ({ id }: { id: string }) => {
  return (
    <Link href={`/node/${id}`} className={styles.download}>
      View More
    </Link>
  );
};

const getAllNetworks = (indexers: NodeData['indexer']): string => {
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

export default function Tsable() {
  const { data, loading, error } = useDataContext();
  const [search, setSearch] = useState('');

  data.sort((a, b) => b.uptime - a.uptime);

  const dataWithIndex = useMemo(() => {
    return data.map((item, index) => ({ ...item, index: index + 1 }));
  }, [data]);

  const filteredData = useMemo(() => {
    return dataWithIndex.filter(item =>
      Object.values(item).some(value =>
        String(value).toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, dataWithIndex]);

  const columns: GridColDef<NodeData>[] = [
    { field: 'index', headerName: 'Index', width: 90 },
    { field: 'id', headerName: 'Node Id', width: 150 },
    { field: 'address', headerName: 'Address', width: 200 },
    { 
      field: 'network', 
      headerName: 'Network', 
      width: 150, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{getAllNetworks(params.row.indexer)}</span>
      ) 
    },
    { 
      field: 'ip', 
      headerName: 'IP', 
      width: 130, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{params.row.ipAndDns?.ip || ''}</span>
      ) 
    },
    { 
      field: 'dns', 
      headerName: 'DNS', 
      width: 130, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{params.row.ipAndDns?.dns || ''}</span>
      ) 
    },
    { 
      field: 'location', 
      headerName: 'Location', 
      width: 180, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{`${params.row.location?.city || ''} ${params.row.location?.country || ''}`}</span>
      ) 
    },
    { 
      field: 'uptime', 
      headerName: 'Week Uptime', 
      width: 150, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatUptime(params.row.uptime)}</span>
      ) 
    },
    {
      field: 'viewMore',
      headerName: '',
      width: 130,
      renderCell: (params: GridRenderCellParams<NodeData>) => <ViewMore id={params.row.id} />,
      sortable: false,
    },
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
          pagination
          loading={loading}
          getRowId={(row) => row.id} // Ensures unique row identification by 'id'
        />
      </div>
    </div>
  );
}
