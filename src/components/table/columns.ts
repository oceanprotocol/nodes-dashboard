export const nodeLeaderboardColumns /*: GridColDef[]*/ = [
  {
    align: 'center',
    field: 'index', // TODO
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'name', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: false,
  },
  {
    field: 'region', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Region',
    sortable: false,
  },
  {
    field: 'eligible', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Reward eligibility',
    sortable: false,
    // renderCell: (params: GridRenderCellParams<NodeData>) => (
    //   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    //     {getEligibleCheckbox(params.row.eligible)}
    //     <span>{params.row.eligible ? 'Eligible' : 'Not Eligible'}</span>
    //   </div>
    // )
  },
  {
    field: 'latestBenchmarkResults.gpuScore', // TODO
    filterable: false,
    flex: 1,
    headerName: 'GPU Score',
    sortable: false,
  },
  {
    field: 'latestBenchmarkResults.cpuScore', // TODO
    filterable: false,
    flex: 1,
    headerName: 'CPU Score',
    sortable: false,
  },
  {
    field: 'latestBenchmarkResults.bandwidth', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Bandwidth',
    sortable: false,
  },
  {
    field: 'gpus', // TODO
    filterable: false,
    flex: 1,
    headerName: 'GPUs',
    sortable: false,
  },
];
