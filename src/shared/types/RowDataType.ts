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
	city: string;
	country: string;
	id: string;
	ip: number;
	lat: number;
	lon: number;
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
	eligibilityCauseStr: string;
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
