export interface SystemStatsData {
  cpuCounts: {
    [key: string]: number;
  };
  operatingSystems: {
    [key: string]: number;
  };
  cpuArchitectures: {
    [key: string]: number;
  };
}
