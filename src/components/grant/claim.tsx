import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { GrantDetails } from '@/types/grant';
import { formatNumber } from '@/utils/formatters';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './claim.module.css';

type ClaimProps = {
  grantDetails: GrantDetails;
};

const Claim: React.FC<ClaimProps> = ({ grantDetails }) => {
  const [claimed, setClaimed] = useState(false);

  const mockSymbol = 'USDC';
  const mockAmount = 100;

  const handleRedeem = async () => {
    try {
      await axios.post('/api/grant/redeem', { email: grantDetails?.email });
      setClaimed(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to redeem grant. Please try again.');
      }
      console.error('Failed to redeem grant', error);
    }
  };

  return (
    <Card className={styles.root} direction="column" padding="md" radius="lg" spacing="lg" variant="glass-shaded">
      <div className={styles.group}>
        <h3>Verification successful</h3>
        <div>You are eligible for grant distribution</div>
      </div>
      <Card className={styles.amountCard} radius="md" variant="accent1-outline">
        <h3>Claimable amount</h3>
        <div className={styles.values}>
          <span className={styles.token}>{mockSymbol}</span>
          &nbsp;
          <span className={styles.amount}>{formatNumber(mockAmount)}</span>
        </div>
      </Card>
      <Button
        autoLoading
        className="alignSelfStretch"
        color="accent2"
        contentBefore={claimed ? <CheckCircleOutlineIcon /> : null}
        disabled={claimed}
        onClick={handleRedeem}
        size="lg"
        variant="filled"
      >
        {claimed ? 'Claimed' : 'Redeem grant'}
      </Button>
    </Card>
  );
};

export default Claim;
