type ProviderType = {
	chainId: string;
	network: string;
};

type IndexerType = {
	chainId: string;
	network: string;
	block: string;
};

type SupportedStorageType = {
	url: boolean;
	arwave: boolean;
	ipfs: boolean;
};

type PlatformType = {
	cpus: number;
	freemem: number;
	totalmem: number;
	loadavg: number[];
	arch: string;
	machine: string;
	platform: string;
	osType: string;
	node: string;
};

type LocationType = {
	ip: string;
	network: string;
	version: string;
	city: string;
	region: string;
	region_code: string;
	country: string;
	country_name: string;
	country_code: string;
	country_code_iso3: string;
	country_capital: string;
	country_tld: string;
	continent_code: string;
	in_eu: boolean;
	postal: string;
	latitude: number;
	longitude: number;
	timezone: string;
	utc_offset: string;
	country_calling_code: string;
	currency: string;
	currency_name: string;
	languages: string;
	country_area: number;
	country_population: number;
	asn: string;
	org: string;
};

type IpAndDnsType = {
	ip: string;
	dns: string;
	port: string;
};

export type NodeData = {
	id: string;
	publicKey: string;
	eligible: boolean;
	eligibilityCause: number;
	address: string;
	version: string;
	http: boolean;
	p2p: boolean;
	provider: ProviderType[];
	indexer: IndexerType[];
	supportedStorage: SupportedStorageType;
	uptime: number;
	platform: PlatformType;
	codeHash: string;
	allowedAdmins: string[];
	location: LocationType;
	ipAndDns: IpAndDnsType;
	lastCheck: number;
};
