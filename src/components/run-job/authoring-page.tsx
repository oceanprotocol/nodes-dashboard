import Container from '@/components/container/container';
import AuthoringPanel from '@/components/run-job/authoring-panel';
import SectionTitle from '@/components/section-title/section-title';
import { useRunJobContext } from '@/context/run-job-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const AuthoringPage = () => {
  const router = useRouter();
  const { account } = useOceanAccount();

  const { authToken, hydrateFromUrlFinished, selectedEnv, selectedResources } = useRunJobContext();

  // The auth token and selection live only in memory, so a direct load / refresh drops us back to the summary.
  useEffect(() => {
    if (hydrateFromUrlFinished && (!authToken || !selectedEnv || !selectedResources)) {
      router.replace({ pathname: '/run-job/summary', query: router.query });
    }
  }, [authToken, hydrateFromUrlFinished, router, selectedEnv, selectedResources]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a job"
        subTitle="Provide your algorithm, dataset, Dockerfile, and env vars, then submit"
        mobileWarning
      />
      {authToken && selectedEnv && selectedResources && account.address ? (
        <div className="pageContentWrapper">
          <AuthoringPanel authToken={authToken} consumerAddress={account.address} />
        </div>
      ) : (
        <CircularProgress className="alignSelfCenter" />
      )}
    </Container>
  );
};

export default AuthoringPage;
