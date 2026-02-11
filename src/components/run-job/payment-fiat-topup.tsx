import Button from '@/components/button/button';
import { SelectedToken } from '@/context/run-job-context';
import { RPC_URL } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import RefreshIcon from '@mui/icons-material/Refresh';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { RampInstantEventTypes, RampInstantSDK } from '@ramp-network/ramp-instant-sdk';
import { IPurchase, IPurchaseCreatedEvent } from '@ramp-network/ramp-instant-sdk/dist/types/types';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './payment-fiat-topup.module.css';

type PaymentFiatTopupProps = {
  currentLockedAmount: number;
  escrowBalance: number;
  loadingPaymentInfo: boolean;
  loadPaymentInfo: () => void;
  selectedToken: SelectedToken;
  totalCost: number;
  walletBalance: number;
};

const GET_STATUS_MAX_TRIES = Number(process.env.NEXT_PUBLIC_RAMP_GET_STATUS_MAX_TRIES ?? 20);
const GET_STATUS_INTERVAL = Number(process.env.NEXT_PUBLIC_RAMP_GET_STATUS_INTERVAL ?? 5000);

const PaymentFiatTopup: React.FC<PaymentFiatTopupProps> = ({
  currentLockedAmount,
  escrowBalance,
  loadingPaymentInfo,
  loadPaymentInfo,
  selectedToken,
  totalCost,
  walletBalance,
}) => {
  const { account } = useOceanAccount();

  // Using refs here to avoid stale state in the ramp event handlers
  // With useState, the events are handled with the state from the time the event handler was registered
  const apiBaseUrlRef = useRef<string | null>(null);
  const getStatusCrtTryRef = useRef(0);
  const purchaseRef = useRef<IPurchase | null>(null);
  const purchaseViewTokenRef = useRef<string | null>(null);

  const [getStatusTimeout, setGetStatusTimeout] = useState<NodeJS.Timeout | null>(null);
  const [loadingGetStatus, setLoadingGetStatus] = useState(false);

  const clearState = () => {
    apiBaseUrlRef.current = null;
    getStatusCrtTryRef.current = 0;
    purchaseRef.current = null;
    purchaseViewTokenRef.current = null;
    if (getStatusTimeout) {
      clearTimeout(getStatusTimeout);
    }
    setGetStatusTimeout(null);
    setLoadingGetStatus(false);
  };

  const isBankTransfer = (purchase: IPurchase) => {
    return purchase.paymentMethodType.includes('BANK');
  };

  const handleTopup = async () => {
    const amountToTopup = totalCost + currentLockedAmount - escrowBalance - walletBalance;
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const tokenContract = new ethers.Contract(selectedToken.address, ERC20Template.abi, provider);
      const tokenDecimals = await tokenContract.decimals();
      const normalizedAmountToTopup = new BigNumber(amountToTopup)
        .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
        .toFixed(0);
      new RampInstantSDK({
        enabledFlows: ['ONRAMP'],
        hideExitButton: false,
        hostApiKey: process.env.NEXT_PUBLIC_RAMP_API_KEY!,
        hostAppName: 'Ocean Network',
        swapAsset: selectedToken.address,
        swapAmount: normalizedAmountToTopup,
        url: process.env.NODE_ENV === 'production' ? undefined : 'https://app.demo.rampnetwork.com',
        userAddress: account.address,
      })
        .on(RampInstantEventTypes.PURCHASE_CREATED, (event: IPurchaseCreatedEvent) => {
          console.log('PURCHASE_CREATED', event);
          getStatusCrtTryRef.current = 0;
          apiBaseUrlRef.current = event.payload.apiUrl;
          purchaseRef.current = event.payload.purchase;
          purchaseViewTokenRef.current = event.payload.purchaseViewToken;
        })
        .on(RampInstantEventTypes.WIDGET_CLOSE, () => {
          if (!apiBaseUrlRef.current || !purchaseRef.current || !purchaseViewTokenRef.current) {
            toast.info('Top-up abandoned. Payment widget closed before payment was initiated');
            return;
          }
          setLoadingGetStatus(true);
          getTransactionInfo();
        })
        .show();
    } catch (error) {
      console.error('Error initiating top-up', error);
      toast.error('Failed to initiate top-up. Please try again.');
      clearState();
    }
  };

  const getTransactionInfo = async () => {
    if (!apiBaseUrlRef.current || !purchaseRef.current || !purchaseViewTokenRef.current) {
      toast.error('Failed to load top-up status. Please check your email for updates');
      clearState();
      return;
    }
    try {
      const response = await axios.get<IPurchase>(
        `${apiBaseUrlRef.current}/host-api/purchase/${purchaseRef.current.id}`,
        {
          params: {
            secret: purchaseViewTokenRef.current,
          },
        }
      );
      switch (response.data.status) {
        case 'INITIALIZED': {
          if (isBankTransfer(response.data)) {
            toast.info('Bank trasnfers are not processed instantly. Please check your email for updates');
          } else {
            toast.info('Top-up abandoned. Payment widget closed before payment was initiated');
          }
          clearState();
          break;
        }
        case 'RELEASED': {
          toast.success('Top-up completed');
          clearState();
          loadPaymentInfo();
          break;
        }
        case 'EXPIRED': {
          toast.error('Top-up expired');
          clearState();
          break;
        }
        case 'CANCELLED': {
          toast.error('Top-up cancelled');
          clearState();
          break;
        }
        default: {
          if (getStatusTimeout) {
            clearTimeout(getStatusTimeout);
          }
          if (isBankTransfer(response.data)) {
            toast.info('Bank trasnfers are not processed instantly. Please check your email for updates');
            clearState();
            return;
          }
          if (getStatusCrtTryRef.current >= GET_STATUS_MAX_TRIES) {
            toast.error('Loading top-up status timed out. Please check your email for updates');
            clearState();
            return;
          }
          getStatusCrtTryRef.current += 1;
          const timeout = setTimeout(() => {
            getTransactionInfo();
          }, GET_STATUS_INTERVAL);
          setGetStatusTimeout(timeout);
          break;
        }
      }
    } catch (error) {
      console.error('Error fetching top-up status', error);
      toast.error('Failed to load top-up status');
      clearState();
    } finally {
    }
  };

  useEffect(() => {
    return () => {
      if (getStatusTimeout) {
        clearTimeout(getStatusTimeout);
      }
    };
  }, [getStatusTimeout]);

  return (
    <div className={styles.buttons}>
      <Button
        autoLoading
        color="accent2"
        contentBefore={<RefreshIcon />}
        onClick={loadPaymentInfo}
        size="lg"
        variant="outlined"
      >
        Refresh
      </Button>
      <Button
        color="accent2"
        contentBefore={loadingGetStatus ? null : <CreditCardIcon />}
        disabled={loadingPaymentInfo}
        loading={loadingGetStatus}
        onClick={handleTopup}
        size="lg"
        variant="filled"
      >
        {loadingGetStatus ? 'Topping up...' : 'Top up'}
      </Button>
    </div>
  );
};

export default PaymentFiatTopup;
