import { TableTypeEnum } from '@/components/table/table-type';
import { type Node } from '@/types';
import { GridApi } from '@mui/x-data-grid';

export const getAllNetworks = (indexers: Node['indexer']): string => {
  return indexers?.map((indexer) => indexer.network).join(', ') || '';
};

export const formatSupportedStorage = (supportedStorage: Node['supportedStorage']): string => {
  const storageTypes = [];

  if (supportedStorage?.url) storageTypes.push('URL');
  if (supportedStorage?.arwave) storageTypes.push('Arweave');
  if (supportedStorage?.ipfs) storageTypes.push('IPFS');

  return storageTypes.join(', ');
};

export const formatPlatform = (platform: Node['platform']): string => {
  if (platform) {
    const { cpus, arch, machine, platform: platformName, osType, node } = platform;
    return `CPUs: ${cpus}, Architecture: ${arch}, Machine: ${machine}, Platform: ${platformName}, OS Type: ${osType}, Node.js: ${node}`;
  }
  return '';
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

export const formatUptimePercentage = (uptimeInSeconds: number, totalUptime: number | null | undefined): string => {
  const defaultTotalUptime = 7 * 24 * 60 * 60;

  const actualTotalUptime = totalUptime || defaultTotalUptime;

  const uptimePercentage = (uptimeInSeconds / actualTotalUptime) * 100;
  const percentage = uptimePercentage > 100 ? 100 : uptimePercentage;
  return `${percentage.toFixed(2)}%`;
};

export const exportToCsv = (apiRef: GridApi, tableType: TableTypeEnum, totalUptime: number | null) => {
  if (!apiRef) return;

  const columns = apiRef.getAllColumns().filter((col) => {
    if (tableType === TableTypeEnum.NODES_LEADERBOARD) {
      return col.field !== 'viewMore' && col.field !== 'location';
    }
    return true;
  });

  const rows = apiRef.getRowModels();

  const formattedRows = Array.from(rows.values()).map((row) => {
    const formattedRow: Record<string, string> = {};

    columns.forEach((column) => {
      const field = column.field;
      const value = row[field];

      // if (tableType === TableTypeEnum.COUNTRIES) {
      //   if (field === 'cityWithMostNodes') {
      //     const cityName = row.cityWithMostNodes || '';
      //     const nodeCount = row.cityWithMostNodesCount || 0;
      //     formattedRow[column.headerName || field] = `${cityName} (${nodeCount})`;
      //   } else {
      //     formattedRow[column.headerName || field] = String(value || '');
      //   }
      // } else {
      //   if (field === 'uptime') {
      //     formattedRow[column.headerName || field] = formatUptimePercentage(value, totalUptime);
      //   } else if (field === 'network') {
      //     const networks = row.provider?.map((p: { network: string }) => p.network).join(', ') || '';
      //     formattedRow[column.headerName || field] = networks;
      //   } else if (field === 'dnsFilter') {
      //     const ipAndDns = row.ipAndDns as { dns?: string; ip?: string; port?: string };
      //     formattedRow[column.headerName || field] =
      //       `${ipAndDns?.dns || ''} ${ipAndDns?.ip || ''} ${ipAndDns?.port ? ':' + ipAndDns?.port : ''}`.trim();
      //   } else if (field === 'city') {
      //     formattedRow[column.headerName || field] = row.location?.city || '';
      //   } else if (field === 'country') {
      //     formattedRow[column.headerName || field] = row.location?.country || '';
      //   } else if (field === 'platform') {
      //     formattedRow[column.headerName || field] = formatPlatform(value);
      //   } else if (field === 'supportedStorage') {
      //     formattedRow[column.headerName || field] = formatSupportedStorage(value);
      //   } else if (field === 'indexer') {
      //     formattedRow[column.headerName || field] = getAllNetworks(value);
      //   } else if (field === 'lastCheck') {
      //     formattedRow[column.headerName || field] = new Date(value).toLocaleString();
      //   } else if (typeof value === 'boolean') {
      //     formattedRow[column.headerName || field] = value ? 'Yes' : 'No';
      //   } else if (Array.isArray(value)) {
      //     formattedRow[column.headerName || field] = value.join(', ');
      //   } else if (field === 'eligibilityCauseStr') {
      //     formattedRow[column.headerName || field] = value || 'none';
      //   } else {
      //     formattedRow[column.headerName || field] = String(value || '');
      //   }
      // }
    });
    return formattedRow;
  });

  const headers = Object.keys(formattedRows[0]);
  const csvRows = [
    headers.join(','),
    ...formattedRows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvRows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${tableType}_export_${new Date().toISOString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
