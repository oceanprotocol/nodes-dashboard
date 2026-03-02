type Route = {
  path: string;
  name: string;
  hideFromNavbar?: boolean;
};

type Routes = {
  [key: string]: Route;
};

type SocialMedia = {
  [key: string]: string;
};

export const API_ROOTS: {
  analytics: string;
  ens: string;
  incentive: string;
  incentive_old: string;
} =
  process.env.NEXT_PUBLIC_APP_ENV === 'production'
    ? {
        analytics: 'https://analytics.oncompute.ai',
        ens: 'https://ens-proxy.oceanprotocol.com/api',
        incentive: 'https://api.oncompute.ai',
        incentive_old: 'https://api.oncompute.ai',
      }
    : {
        analytics: 'https://analytics.nodes.oceanprotocol.io',
        ens: 'https://ens-proxy.oceanprotocol.com/api',
        incentive: 'https://incentive-backend.oceanprotocol.io',
        incentive_old: 'https://incentive-backend.oceanprotocol.com',
      };

type Config = {
  backendUrl: string;
  routes: Routes;
  socialMedia: SocialMedia;
  links: {
    docs: string;
    website: string;
    github: string;
  };
  queryParams: {
    [key: string]: string;
  };
  cookies: {
    [key: string]: string;
  };
  supportEmail: string;
};

const config: Config = {
  backendUrl: API_ROOTS.incentive,
  routes: {
    home: {
      path: '/',
      name: 'Home',
    },
    runJob: {
      path: '/run-job/environments',
      name: 'Run a job',
    },
    stats: {
      path: '/stats',
      name: 'Stats',
    },
    // docs: {
    //   path: 'https://docs.oncompute.ai/',
    //   name: 'Docs',
    //   hideFromNavbar: true,
    // },
    leaderboard: {
      path: '/leaderboard',
      name: 'Leaderboard',
    },
    runNode: {
      path: '/run-node/setup',
      name: 'Run a node',
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
    docs: 'https://docs.oncompute.ai/',
    website: 'https://oceanprotocol.com/',
    github: 'https://github.com/oceanprotocol/ocean-node',
  },
  queryParams: {
    accessToken: 'access_token',
    status: 'status',
  },
  supportEmail: 'support@oncompute.ai',
  cookies: {
    accessToken: 'access_token',
  },
};

export default config;

export const getRoutes = (): Routes => config.routes;
export const getSocialMedia = (): SocialMedia => config.socialMedia;
export const getLinks = () => config.links;

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
  owners: { root: 'incentive', path: '/owners' },
  admin: { root: 'incentive', path: '/admin' },
  jobsSuccessRate: { root: 'incentive', path: '/consumers' },
  nodesStats: { root: 'incentive', path: '/owners' },

  // Analytics API routes
  analyticsSummary: { root: 'analytics', path: '/summary' },
  analyticsAllSummary: { root: 'analytics', path: '/all-summary' },
  analyticsRewardsHistory: { root: 'analytics', path: '/rewards-history' },
  analyticsGlobalStats: { root: 'analytics', path: '/global-stats' },
  gpuPopularity: { root: 'analytics', path: '/gpu-popularity' },
  topNodesByRevenue: { root: 'analytics', path: '/nodes' },
  topNodesByJobCount: { root: 'analytics', path: '/nodes' },
  nodeStats: { root: 'analytics', path: '/nodes' },
  consumerStats: { root: 'analytics', path: '/consumers' },
  ownerStats: { root: 'analytics', path: '/owners' },

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
