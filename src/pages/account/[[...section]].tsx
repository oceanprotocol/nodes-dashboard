import AccountPage from '@/components/account/account-page';
import { DEFAULT_ACCOUNT_SECTION, isAccountSectionKey } from '@/components/account/account-sections';
import { useRouter } from 'next/router';

const AccountRoute: React.FC = () => {
  const router = useRouter();

  // router.query is empty until isReady, so resolving early would flash — and mount — the
  // default section for one render even when a valid section was requested in the URL.
  if (!router.isReady) {
    return null;
  }

  const segments = router.query.section;
  const requested = Array.isArray(segments) ? segments[0] : segments;
  const section = isAccountSectionKey(requested) ? requested : DEFAULT_ACCOUNT_SECTION;

  return <AccountPage section={section} />;
};

export default AccountRoute;
