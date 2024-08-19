import React, { useMemo, useState } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams, GridToolbar } from '@mui/x-data-grid';
import styles from './index.module.css';
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

const formatSupportedStorage = (supportedStorage: NodeData['supportedStorage']): string => {
  const storageTypes = [];

  if (supportedStorage.url) storageTypes.push('URL');
  if (supportedStorage.arwave) storageTypes.push('Arweave');
  if (supportedStorage.ipfs) storageTypes.push('IPFS');

  return storageTypes.join(', ');
};

const formatPlatform = (platform: NodeData['platform']): string => {
  const { cpus, arch, machine, platform: platformName, osType, node } = platform;
  return `CPUs: ${cpus}, Architecture: ${arch}, Machine: ${machine}, Platform: ${platformName}, OS Type: ${osType}, Node.js: ${node}`;
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
    { field: 'index', headerName: 'Index', width: 20 },
    { field: 'id', headerName: 'Node Id', flex: 1, minWidth: 150 },
    { field: 'address', headerName: 'Address', flex: 1, minWidth: 200 },
    { 
      field: 'network', 
      headerName: 'Network',
      flex: 1, 
      minWidth: 150, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{getAllNetworks(params.row.indexer)}</span>
      ) 
    },
    { 
      field: 'dns', 
      headerName: 'DNS / IP',
      flex: 1, 
      minWidth: 130, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{params.row.ipAndDns?.dns || ''}</span>
      ) 
    },
    { 
      field: 'location', 
      headerName: 'Location',
      flex: 1, 
      minWidth: 180, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{`${params.row.location?.city || ''} ${params.row.location?.country || ''}`}</span>
      ) 
    },
    { 
      field: 'uptime', 
      headerName: 'Week Uptime',
      flex: 1, 
      minWidth: 150, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatUptime(params.row.uptime)}</span>
      ) 
    },
    {
      field: 'viewMore',
      headerName: '',
      width: 85,
      renderCell: (params: GridRenderCellParams<NodeData>) => <ViewMore id={params.row.id} />,
      sortable: false,
    },
    // Additional columns that might be toggled on/off
    { field: 'publicKey', headerName: 'Public Key', flex: 1, minWidth: 200 },
    { field: 'version', headerName: 'Version', flex: 1, minWidth: 100 },
    { field: 'http', headerName: 'HTTP Enabled', flex: 1, minWidth: 100 },
    { field: 'p2p', headerName: 'P2P Enabled', flex: 1, minWidth: 100 },
    { 
      field: 'supportedStorage', 
      headerName: 'Supported Storage', 
      flex: 1, 
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatSupportedStorage(params.row.supportedStorage)}</span>
      )
    },
    { 
      field: 'platform', 
      headerName: 'Platform', 
      flex: 1, 
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatPlatform(params.row.platform)}</span>
      )
    },
    { field: 'codeHash', headerName: 'Code Hash', flex: 1, minWidth: 200 },
    { field: 'allowedAdmins', headerName: 'Allowed Admins', flex: 1, minWidth: 200 },
    { field: 'lastCheck', headerName: 'Last Check', flex: 1, minWidth: 150 },
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
      <div style={{ height: '100%', width: '100%' }}>
        <DataGrid
          rows={filteredData}
          columns={columns}
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 }
            }
          }}
          initialState={{
            columns: {
              columnVisibilityModel: {
                // Hide these columns by default
                publicKey: false,
                version: false,
                http: false,
                p2p: false,
                supportedStorage: false,
                platform: false,
                codeHash: false,
                allowedAdmins: false,
                lastCheck: false,
              },
            },
            pagination: {
              paginationModel: {
                pageSize: 25,
              },
            },
          }}
          pagination
          pageSizeOptions={[10, 25, 50, 100, 200]}
          loading={loading}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
        />
      </div>
    </div>
  );
}
