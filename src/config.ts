type Route = {
  path: string
  name: string
}

type Routes = {
  [key: string]: Route
}

type SocialMedia = {
  [key: string]: string
}

type ApiRoutes = {
  [key: string]: string | ((param: string | number) => string)
}

type Config = {
  backendUrl: string
  routes: Routes
  apiRoutes: ApiRoutes
  socialMedia: SocialMedia
  links: {
    website: string
  }
  queryParams: {
    [key: string]: string
  }
  cookies: {
    [key: string]: string
  }
}

const apiRoutes = {
  nodes: '/nodes',
  locations: '/locations',
  countryStats: '/countryStats',
  nodeSystemStats: '/nodeSystemStats'
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
    discord: 'https://discord.gg/oceanprotocol',
    youtube: 'https://www.youtube.com/channel/UCH8TXwmWWAE9TZO0yTBHB3A',
    telegram: 'https://t.me/oceanprotocol'
  },
  links: {
    website: 'https://oceanprotocol.com/'
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
  const route = config.apiRoutes[key]
  if (typeof route === 'function' && param !== undefined) {
    return `${config.backendUrl}${route(param)}`
  }
  return `${config.backendUrl}${route}`
}
