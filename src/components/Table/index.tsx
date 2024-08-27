import React, { useMemo, useState } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams, GridToolbar } from '@mui/x-data-grid';
import styles from './index.module.css';
import { NodeData } from '../../shared/types/RowDataType';
import { useDataContext } from '@/context/DataContext';
import NodeDetails from './NodeDetails';
import { Button, Link, Tooltip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';

const ViewMore = ({ id }: { id: string }) => {
  return (
    <Link href={`/node/${id}`} className={styles.download}>
      View More
    </Link>
  );
};

const getAllNetworks = (indexers: NodeData['indexer']): string => {
  return indexers?.map(indexer => indexer.network).join(', ');
};

export const formatSupportedStorage = (supportedStorage: NodeData['supportedStorage']): string => {
  const storageTypes = [];

  if (supportedStorage?.url) storageTypes.push('URL');
  if (supportedStorage?.arwave) storageTypes.push('Arweave');
  if (supportedStorage?.ipfs) storageTypes.push('IPFS');

  return storageTypes.join(', ');
};

export const formatPlatform = (platform: NodeData['platform']): string => {
  if(platform){
    const { cpus, arch, machine, platform: platformName, osType, node } = platform;
    return `CPUs: ${cpus}, Architecture: ${arch}, Machine: ${machine}, Platform: ${platformName}, OS Type: ${osType}, Node.js: ${node}`;
  }
  return ''
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


const getEligibleCheckbox = (eligible: boolean): React.ReactElement => {
  return eligible ? (
    <CheckCircleOutlineIcon style={{ color: 'green' }} />
  ) : (
    <CancelOutlinedIcon style={{ color: 'red' }} />
  );
};


export default function Table() {
  const { data, loading, error } = useDataContext();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);  // State to track selected node

  // data.sort((a, b) => b.uptime - a.uptime);

  const dataWithIndex = useMemo(() => {
    return data.sort((a, b) => {
      if (a.eligible !== b.eligible) {
        return a.eligible ? -1 : 1;
      }
      return b.uptime - a.uptime;
    }).map((item, index) => ({ ...item, index: index + 1, dns: item.ipAndDns?.dns}));
  }, [data]);


  const columns: GridColDef<NodeData>[] = [
    {
      field: 'index',
      renderHeader: () => (
        <Tooltip title="The first 50 will receive a soulbound NFT">
          <span>Index</span>
        </Tooltip>
      ),
      width: 20,
    },
    { field: 'id', headerName: 'Node Id', flex: 1, minWidth: 150 },
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
      field: 'dns', 
      headerName: 'DNS / IP',
      flex: 1, 
      minWidth: 130, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{(params.row.ipAndDns?.dns || params.row.ipAndDns?.ip || '') +':'+params.row.ipAndDns?.port }</span>
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
    { field: 'address', headerName: 'Address', flex: 1, minWidth: 200 },
    { 
      field: 'eligible', 
      headerName: 'Reward Eligibility',
      flex: 1, 
      width: 20,
      renderHeader: () => (
        <Tooltip title="These nodes are eligible to receive rewards in proportion to their uptime.">
          <span>Reward Eligibility</span>
        </Tooltip>
      ),
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span>{getEligibleCheckbox(params.row.eligible)}</span>
        </div>
      ) 
    },
    { 
      field: 'eligibilityCause', 
      headerName: 'Eligibility Issue ',
      flex: 1, 
      width: 50,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
          <span>{params.row.eligibilityCause || 'none' }</span>
      ) 
    },
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
      field: 'viewMore', 
      headerName: '', 
      width: 150, 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <Button 
          onClick={() => setSelectedNode(params.row)} 
          className={styles.download}
        >
          View More
        </Button>
      ),
      sortable: false,
    },
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
      <div style={{ height: '100%', width: '100%' }}>
        <DataGrid
          rows={dataWithIndex}
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
                network: false,
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
          pageSizeOptions={[10, 25, 50, 100]}
          loading={loading}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
        />
      </div>

      {selectedNode && (
        <NodeDetails 
          nodeData={selectedNode} 
          onClose={() => setSelectedNode(null)} 
        />
      )}
    </div>
  );
}
