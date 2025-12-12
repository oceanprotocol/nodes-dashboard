type Route = {
  path: string;
  name: string;
};

type Routes = {
  [key: string]: Route;
};

type SocialMedia = {
  [key: string]: string;
};

type Config = {
  backendUrl: string;
  routes: Routes;
  socialMedia: SocialMedia;
  links: {
    website: string;
    github: string;
  };
  queryParams: {
    [key: string]: string;
  };
  cookies: {
    [key: string]: string;
  };
};

const config: Config = {
  backendUrl: process.env.NEXT_PUBLIC_API_URL || 'https://incentive-backend.oceanprotocol.com',
  routes: {
    home: {
      path: '/',
      name: 'Home',
    },
    runJob: {
      path: '/run-job/environments',
      name: 'Run Job',
    },
    stats: {
      path: '/stats',
      name: 'Stats',
    },
    docs: {
      path: '/docs',
      name: 'Docs',
    },
    leaderboard: {
      path: '/leaderboard',
      name: 'Leaderboard',
    },
    runNode: {
      path: '/run-node',
      name: 'Run Node',
    },
  },
  socialMedia: {
    medium: 'https://medium.com/oceanprotocol',
    twitter: 'https://twitter.com/oceanprotocol',
    discord: 'https://discord.gg/CjdsWngg47',
    youtube: 'https://www.youtube.com/channel/UCH8TXwmWWAE9TZO0yTBHB3A',
    telegram: 'https://t.me/oceanprotocol',
  },
  links: {
    website: 'https://oceanprotocol.com/',
    github: 'https://github.com/oceanprotocol/ocean-node',
  },
  queryParams: {
    accessToken: 'access_token',
    status: 'status',
  },
  cookies: {
    accessToken: 'access_token',
  },
};

export default config;

export const getRoutes = (): Routes => config.routes;
export const getSocialMedia = (): SocialMedia => config.socialMedia;
export const getLinks = () => config.links;

const API_ROOTS = {
  ens: 'https://ens-proxy.oceanprotocol.com/api',
  incentive: 'https://incentive-backend.oceanprotocol.io',
  incentive_old: 'https://incentive-backend.oceanprotocol.com',
  analytics: 'https://analytics.nodes.oceanprotocol.io',
} as const;

const apiRoutes = {
  // Incentive API routes
  environments: { root: 'incentive', path: '/envs' },
  nodes: { root: 'incentive', path: '/nodes' },
  locations: { root: 'incentive', path: '/locations' },
  countryStats: { root: 'incentive', path: '/countryStats' },
  nodeSystemStats: { root: 'incentive_old', path: '/nodeSystemStats' },
  history: { root: 'incentive', path: '/history' },
  weekStats: { root: 'incentive', path: '/weekStats' },
  banStatus: { root: 'incentive', path: '/nodes' },
  nodeBenchmarkMinMaxLast: { root: 'incentive', path: '/nodes' },
  benchmarkHistory: { root: 'incentive', path: '/nodes' },
  nodeUnbanRequests: { root: 'incentive', path: '/nodes' },
  admin: { root: 'incentive', path: '/admin' },

  // Analytics API routes
  analyticsSummary: { root: 'analytics', path: '/summary' },
  analyticsAllSummary: { root: 'analytics', path: '/all-summary' },
  analyticsRewardsHistory: { root: 'analytics', path: '/rewards-history' },
  analyticsGlobalStats: { root: 'analytics', path: '/global-stats' },
  gpuPopularity: { root: 'analytics', path: '/gpu-popularity' },
  topNodesByRevenue: { root: 'analytics', path: '/nodes' },
  topNodesByJobCount: { root: 'analytics', path: '/nodes' },
  nodeStats: { root: 'analytics', path: '/nodes' },

  // ENS API routes
  ensAddress: { root: 'ens', path: '/address' },
  ensName: { root: 'ens', path: '/name' },
  ensProfile: { root: 'ens', path: '/profile' },
} as const;

type ApiRouteKeys = keyof typeof apiRoutes;

export const getApiRoute = (key: ApiRouteKeys): string => {
  const route = apiRoutes[key];
  const baseUrl = API_ROOTS[route.root];
  return `${baseUrl}${route.path}`;
};
