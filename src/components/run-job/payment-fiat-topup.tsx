import Button from '@/components/button/button';
import { useOceanAccount } from '@/lib/use-ocean-account';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './payment-fiat-topup.module.css';

const MoonPayBuyWidget = dynamic(() => import('@moonpay/moonpay-react').then((mod) => mod.MoonPayBuyWidget), {
  ssr: false,
});

type PaymentFiatTopupProps = {
  // currentLockedAmount: number;
  escrowBalance: number;
  loadingPaymentInfo: boolean;
  loadPaymentInfo: () => void;
  renderBackButton?: (disabled: boolean) => React.ReactNode;
  // selectedToken: SelectedToken;
  totalCost: number;
  walletBalance: number;
};

const PaymentFiatTopup: React.FC<PaymentFiatTopupProps> = ({
  // currentLockedAmount,
  escrowBalance,
  loadingPaymentInfo,
  loadPaymentInfo,
  renderBackButton,
  // selectedToken,
  totalCost,
  walletBalance,
}) => {
  const { account } = useOceanAccount();

  const [loadingTopup, setLoadingTopup] = useState(false);
  const [widgetVisible, setWidgetVisible] = useState(false);

  const amountToTopup = Math.max(0, totalCost - escrowBalance - walletBalance);

  const handleUrlSignatureRequested = async (url: string) => {
    try {
      const response = await axios.post<{ signature: string }>('/api/moonpay/sign-url', {
        urlForSignature: url,
      });
      return response.data.signature;
    } catch (error) {
      console.error('Error signing MoonPay URL', error);
      toast.error('Failed to open payment widget. Please try again.');
      return '';
    }
  };

  return (
    <div>
      <MoonPayBuyWidget
        // baseCurrencyCode="usd"
        currencyCode="usdc_base"
        onUrlSignatureRequested={handleUrlSignatureRequested}
        quoteCurrencyAmount={String(Math.ceil(amountToTopup * 100) / 100)}
        paymentMethod="credit_debit_card"
        onClose={async () => setWidgetVisible(false)}
        onTransactionCreated={async () => {
          setLoadingTopup(true);
        }}
        onTransactionCompleted={async ({ status }) => {
          setLoadingTopup(false);
          switch (status) {
            // 'completed' | 'failed' | 'pending' | 'waitingAuthorization' | 'waitingPayment'
            case 'completed': {
              toast.success('Payment completed');
              loadPaymentInfo();
              break;
            }
            case 'failed': {
              toast.error('Payment failed');
              break;
            }
            case 'pending': {
              toast.info('Payment pending');
              break;
            }
            case 'waitingAuthorization': {
              toast.info('Payment waiting authorization');
              break;
            }
            case 'waitingPayment': {
              toast.info('Payment waiting payment');
              break;
            }
          }
        }}
        theme="light"
        variant="overlay"
        visible={widgetVisible}
        walletAddress={account.address}
      />
      <div className={styles.buttons}>
        {renderBackButton?.(loadingPaymentInfo)}
        <div className={styles.buttonsGroup}>
          <Button
            autoLoading
            color="accent1"
            contentBefore={<RefreshIcon />}
            disabled={loadingTopup || loadingPaymentInfo}
            onClick={loadPaymentInfo}
            size="lg"
            variant="outlined"
          >
            Refresh wallet balance
          </Button>
          <Button
            color="accent1"
            contentBefore={<CreditCardIcon />}
            loading={loadingTopup || loadingPaymentInfo}
            onClick={() => setWidgetVisible(true)}
            size="lg"
            variant="filled"
          >
            Top up
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentFiatTopup;
