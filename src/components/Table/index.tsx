import React, { useMemo, useState } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams, GridToolbar } from '@mui/x-data-grid';
import styles from './index.module.css';
import { NodeData } from '../../shared/types/RowDataType';
import { useDataContext } from '@/context/DataContext';
import NodeDetails from './NodeDetails';
import { Link, Tooltip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { NOT_ELIGIBLE_STATUS_CODES } from '@/shared/utils/constants';

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

export const formatSupportedStorage = (supportedStorage: NodeData['supportedStorage']): string => {
  const storageTypes = [];

  if (supportedStorage.url) storageTypes.push('URL');
  if (supportedStorage.arwave) storageTypes.push('Arweave');
  if (supportedStorage.ipfs) storageTypes.push('IPFS');

  return storageTypes.join(', ');
};

export const formatPlatform = (platform: NodeData['platform']): string => {
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


const getEligibleCheckbox = (eligible: boolean): React.ReactElement => {
  return eligible ? (
    <CheckCircleOutlineIcon style={{ color: 'green' }} />
  ) : (
    <CancelOutlinedIcon style={{ color: 'red' }} />
  );
};


const getNodeEligibilityCause = (cause: number): React.ReactElement => {
  const eligibilityCause = cause ?  NOT_ELIGIBLE_STATUS_CODES[cause] : "none"
  return <span>{eligibilityCause}</span>
};


export default function Tsable() {
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
        <span>{getEligibleCheckbox(params.row.eligible)}</span>
      ) 
    },
    { 
      field: 'eligibilityCause', 
      headerName: 'Eligibility Issue',
      flex: 1, 
      minWidth: 120,
      renderHeader: () => (
        <Tooltip title="This nodes has the following issues that will prevent it from receiving rewards.">
          <span>Eligibility Issue</span>
        </Tooltip>
      ), 
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{getNodeEligibilityCause(params.row.eligibilityCause)}</span>
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
        <button 
          onClick={() => setSelectedNode(params.row)} 
          className={styles.download}
        >
          View More
        </button>
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
