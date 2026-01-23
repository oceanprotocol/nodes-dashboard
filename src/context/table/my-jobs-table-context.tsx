import { TableContextType } from '@/components/table/context-type';
import { ComputeJob } from '@/types/jobs';
import { formatDateTime } from '@/utils/formatters';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const MOCK_JOBS = [
  {
    owner: '0xD8127C2896F6D6aB77aa7F89fa4eA4a45a802EB5',
    peerId: '16Uiu2HAm94yL3Sjem2piKmGkiHCdJyTn3F3aWueZTXKT38ekjuzr',
    did: null,
    jobId: 'eeb410d076969a73df41dfb9bd396f970927db82a0a7e38896ea15482cd5bed0',
    dateCreated: '1769093457.444',
    dateFinished: '1769093488.242',
    status: 70,
    statusText: 'Job finished',
    results: [
      {
        filename: 'image.log',
        filesize: 657,
        type: 'imageLog',
        index: 0,
      },
      {
        filename: 'configuration.log',
        filesize: 324,
        type: 'configurationLog',
        index: 1,
      },
      {
        filename: 'algorithm.log',
        filesize: 73,
        type: 'algorithmLog',
        index: 2,
      },
      {
        filename: 'outputs.tar',
        filesize: 2560,
        type: 'output',
        index: 3,
      },
    ],
    inputDID: null,
    algoDID: null,
    agreementId: null,
    environment:
      '0xbdb567c65546d4cea59bf78a2e21945440f43c7ce7a1904311629c76bd0926de-0x889acb9c95c773972d7013201c01eba96315bb4be7e18926ceaf40716c438e07',
    stopRequested: false,
    resources: [
      {
        id: 'cpu',
        amount: 1,
      },
      {
        id: 'ram',
        amount: 1,
      },
      {
        id: 'disk',
        amount: 1,
      },
      {
        id: 'gpu0',
        amount: 1,
      },
      {
        id: 'gpu1',
        amount: 0,
      },
      {
        id: 'gpu2',
        amount: 0,
      },
      {
        id: 'gpu3',
        amount: 0,
      },
      {
        id: 'gpu4',
        amount: 0,
      },
      {
        id: 'gpu5',
        amount: 0,
      },
      {
        id: 'gpu6',
        amount: 0,
      },
      {
        id: 'gpu7',
        amount: 0,
      },
    ],
    isFree: true,
    algoStartTimestamp: '1769093481.196',
    algoStopTimestamp: '1769093486.21',
    terminationDetails: {
      exitCode: 0,
      OOMKilled: false,
    },
    payment: null,
    algoDuration: 5.013999938964844,
    queueMaxWaitTime: 0,
    maxJobDuration: 7200,
  },
];

type CtxType = TableContextType<ComputeJob>;

const MyJobsTableContext = createContext<CtxType | undefined>(undefined);

export const MyJobsTableProvider = ({ children, consumer }: { children: ReactNode; consumer: string | undefined }) => {
  const [crtPage, setCrtPage] = useState<CtxType['crtPage']>(1);
  const [data, setData] = useState<CtxType['data']>([]);
  const [error, setError] = useState<CtxType['error']>(null);
  const [filterModel, setFilterModel] = useState<CtxType['filterModel']>({ items: [] });
  const [filters, setFilters] = useState<CtxType['filters']>({});
  const [loading, setLoading] = useState<CtxType['loading']>(false);
  const [pageSize, setPageSize] = useState<CtxType['pageSize']>(100);
  const [searchTerm, setSearchTerm] = useState<CtxType['searchTerm']>('');
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({});
  const [totalItems, setTotalItems] = useState<CtxType['totalItems']>(0);

  const fetchData = useCallback(async () => {
    if (!consumer) {
      return;
    }
    setLoading(true);
    try {
      // Using mock data instead of API call
      const sanitizedData = MOCK_JOBS.map((element: any, index: number) => ({
        ...element,
        id: element.jobId,
        startTime: formatDateTime(element.dateCreated),
        index: (crtPage - 1) * pageSize + index + 1,
      }));

      setData(sanitizedData);
      setTotalItems(MOCK_JOBS.length);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [crtPage, pageSize, consumer]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchAllData = async () => {
      if (!mounted) return;
      try {
        await fetchData();
      } catch (error) {
        console.error('Error fetching initial leaderboard data:', error);
      } finally {
        if (mounted) {
          // (false);
        }
      }
    };

    fetchAllData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [fetchData]);

  const handleSetFilterModel: CtxType['setFilterModel'] = (filter) => {
    setFilterModel(filter);
    setCrtPage(1);
  };

  const handleSetFilters: CtxType['setFilters'] = (newFilters: { [key: string]: any }) => {
    setFilters(newFilters);
    setCrtPage(1);
  };

  const handleSetPageSize: CtxType['setPageSize'] = (size) => {
    setPageSize(size);
    setData([]);
  };

  const handleSetSearchTerm: CtxType['setSearchTerm'] = (term) => {
    setSearchTerm(term);
    setCrtPage(1);
  };

  const handleSetSortModel: CtxType['setSortModel'] = (model) => {
    setSortModel(model);
    setCrtPage(1);
  };

  return (
    <MyJobsTableContext.Provider
      value={{
        crtPage,
        data,
        fetchData,
        error,
        filterModel,
        filters,
        loading,
        pageSize,
        searchTerm,
        sortModel,
        totalItems,
        setCrtPage,
        setFilterModel: handleSetFilterModel,
        setFilters: handleSetFilters,
        setPageSize: handleSetPageSize,
        setSearchTerm: handleSetSearchTerm,
        setSortModel: handleSetSortModel,
      }}
    >
      {children}
    </MyJobsTableContext.Provider>
  );
};

export const useMyJobsTableContext = () => {
  const context = useContext(MyJobsTableContext);
  if (!context) {
    throw new Error('useMyJobsTableContext must be used within a MyJobsTableProvider');
  }
  return context;
};
