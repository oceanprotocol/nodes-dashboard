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
      path: '/run-job',
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
    leaderbord: {
      path: '/leaderbord',
      name: 'Leaderbord',
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
