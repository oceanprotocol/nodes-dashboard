import AuthRequiredPage from '@/components/auth/auth-required-page';
import FiatTopupPage from '@/components/dev/fiat-topup-page';
import { FIAT_TOPUP_ENABLED } from '@/lib/use-usdc-topup';
import type { GetServerSideProps } from 'next';
import React from 'react';

// Hidden spike page: 404s unless NEXT_PUBLIC_FIAT_TOPUP=1. See docs/specs/privy-fiat-onramp.md.
export const getServerSideProps: GetServerSideProps = async () =>
  FIAT_TOPUP_ENABLED ? { props: {} } : { notFound: true };

const FiatTopupPageWrapper: React.FC = () => {
  return (
    <AuthRequiredPage>
      <FiatTopupPage />
    </AuthRequiredPage>
  );
};

export default FiatTopupPageWrapper;
