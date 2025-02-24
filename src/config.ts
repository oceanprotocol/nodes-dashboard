type Route = {
  path: string
  name: string
}

type Routes = {
  [key: string]: Route
}

type ApiRoute = {
  root: 'incentive' | 'analytics'
  path: string
}

type ApiRoutes = {
  [key: string]: ApiRoute
}

type SocialMedia = {
  [key: string]: string
}

type Config = {
  backendUrl: string
  routes: Routes
  apiRoutes: ApiRoutes
  socialMedia: SocialMedia
  links: {
    website: string
    github: string
  }
  queryParams: {
    [key: string]: string
  }
  cookies: {
    [key: string]: string
  }
}

const API_ROOTS = {
  incentive: 'https://incentive-backend.oceanprotocol.com',
  analytics: 'https://analytics.nodes.oceanprotocol.com'
} as const

const apiRoutes = {
  // Incentive API routes
  nodes: { root: 'incentive', path: '/nodes' },
  locations: { root: 'incentive', path: '/locations' },
  countryStats: { root: 'incentive', path: '/countryStats' },
  nodeSystemStats: { root: 'incentive', path: '/nodeSystemStats' },
  weekStats: { root: 'incentive', path: '/weekStats' },

  // Analytics API routes
  analyticsSummary: { root: 'analytics', path: '/summary' },
  analyticsAllSummary: { root: 'analytics', path: '/all-summary' },
  analyticsRewardsHistory: { root: 'analytics', path: '/rewards-history' }
} as const

type ApiRouteKeys = keyof typeof apiRoutes

const config: Config = {
  backendUrl:
    process.env.NEXT_PUBLIC_API_URL || 'https://incentive-backend.oceanprotocol.com',
  routes: {
    home: {
      path: '/',
      name: 'Home'
    },
    nodes: {
      path: '/nodes',
      name: 'Nodes'
    },
    countries: {
      path: '/countries',
      name: 'Countries'
    }
  },
  apiRoutes,
  socialMedia: {
    medium: 'https://medium.com/oceanprotocol',
    twitter: 'https://twitter.com/oceanprotocol',
    discord: 'https://discord.gg/CjdsWngg47',
    youtube: 'https://www.youtube.com/channel/UCH8TXwmWWAE9TZO0yTBHB3A',
    telegram: 'https://t.me/oceanprotocol'
  },
  links: {
    website: 'https://oceanprotocol.com/',
    github: 'https://github.com/oceanprotocol/ocean-node'
  },
  queryParams: {
    accessToken: 'access_token',
    status: 'status'
  },
  cookies: {
    accessToken: 'access_token'
  }
}

export default config

export const getRoutes = (): Routes => config.routes
export const getSocialMedia = (): SocialMedia => config.socialMedia
export const getLinks = () => config.links
export const getApiRoute = (key: ApiRouteKeys, param?: string | number): string => {
  const route = apiRoutes[key]
  const baseUrl = API_ROOTS[route.root]
  return `${baseUrl}${route.path}`
}
