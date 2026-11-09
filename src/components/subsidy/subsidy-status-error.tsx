import Button from '@/components/button/button';
import { SUBSIDY_STATUS_ERROR } from '@/components/subsidy/subsidy-copy';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useState } from 'react';

const SubsidyStatusError = () => {
  const { account } = useOceanAccount();
  const { fetchSubsidyStatus } = useProfileContext();
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = async () => {
    if (!account.address) {
      return;
    }
    setIsRetrying(true);
    await fetchSubsidyStatus(account.address);
    setIsRetrying(false);
  };

  return (
    <div className="actionsGroupMdCenter">
      <span className="textSecondary">{SUBSIDY_STATUS_ERROR}</span>
      <Button color="accent1" loading={isRetrying} onClick={retry} size="md" variant="outlined">
        Try again
      </Button>
    </div>
  );
};

export default SubsidyStatusError;
