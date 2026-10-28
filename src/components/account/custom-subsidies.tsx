import { BlockHeader, CreditBlock, DiscountBlock } from '@/components/account/subsidy-blocks';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import LookupModal from '@/components/modal/lookup-modal';
import { getExplorerAddressUrl } from '@/constants/chains';
import { USDC } from '@/constants/tokens';
import { getSubsidyProviderAddresses, loadCustomSubsidyProgram } from '@/lib/subsidy';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { CustomSubsidy, useAddCustomSubsidy, useCustomSubsidies, useRemoveCustomSubsidy } from '@/lib/use-subsidy';
import { formatError, formatWalletAddress } from '@/utils/formatters';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LaunchIcon from '@mui/icons-material/Launch';
import { CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { useState } from 'react';
import styles from './subsidy-section.module.css';

const getStatusChip = ({ data }: CustomSubsidy) => {
  if (!data) {
    return null;
  }
  if (!data.program) {
    return <span className="chip chipError">Unsupported</span>;
  }
  if (data.usage?.paused) {
    return <span className="chip chipError">Unavailable</span>;
  }
  if (!data.usage?.userAllowed) {
    return <span className="chip chipWarning">Not on list</span>;
  }
  return <span className="chip chipSuccess">Active</span>;
};

const getStatusNote = ({ data }: CustomSubsidy) => {
  if (!data?.usage) {
    return null;
  }
  if (data.usage.paused) {
    return 'This subsidy is paused or out of funds. Jobs are charged without it.';
  }
  if (!data.usage.userAllowed) {
    return "Your wallet isn't on this subsidy's access list. Jobs are charged without it until it is.";
  }
  return null;
};

type CustomSubsidyCardProps = {
  onRemove: (address: string) => void;
  subsidy: CustomSubsidy;
};

const CustomSubsidyCard = ({ onRemove, subsidy }: CustomSubsidyCardProps) => {
  const { address, data, isError, isLoading } = subsidy;

  const action = (
    <>
      {getStatusChip(subsidy)}
      <Button
        aria-label="Remove subsidy"
        color="accent1"
        contentBefore={<DeleteOutlineIcon fontSize="small" />}
        onClick={() => onRemove(address)}
        size="sm"
        variant="transparent"
      >
        Remove
      </Button>
    </>
  );

  const caption = (
    <a
      className={styles.addressLink}
      href={getExplorerAddressUrl(address)}
      rel="noopener noreferrer"
      target="_blank"
      title={address}
    >
      {formatWalletAddress(address)}
      <LaunchIcon fontSize="inherit" />
    </a>
  );

  const note = getStatusNote(subsidy);
  const children = note ? <span className={styles.small}>{note}</span> : null;

  if (data?.program?.oneTime && data.usage?.oneTime) {
    return (
      <CreditBlock
        action={action}
        allowance={data.usage.oneTime}
        caption={caption}
        percent={data.program.oneTime.percent}
        tone="custom"
      >
        {children}
      </CreditBlock>
    );
  }

  if (data?.program?.discount && data.usage?.discount) {
    return (
      <DiscountBlock
        action={action}
        caption={caption}
        percent={data.program.discount.percent}
        tone="custom"
        windows={data.usage.discount.windows}
      >
        {children}
      </DiscountBlock>
    );
  }

  return (
    <Card className={styles.block} innerShadow="black" radius="sm" variant="glass">
      <BlockHeader action={action} caption={caption} title="Subsidy" tone="custom" />
      {isLoading ? (
        <CircularProgress className="alignSelfCenter" size={24} />
      ) : isError ? (
        <span className={styles.small}>Couldn&apos;t load this subsidy. Try again later.</span>
      ) : data && !data.program ? (
        <span className={styles.small}>This contract can&apos;t prepay jobs in {USDC.symbol} right now.</span>
      ) : null}
    </Card>
  );
};

const CustomSubsidies = () => {
  const { account } = useOceanAccount();
  const { subsidies } = useCustomSubsidies();
  const addCustomSubsidy = useAddCustomSubsidy();
  const removeCustomSubsidy = useRemoveCustomSubsidy();

  const [addOpen, setAddOpen] = useState(false);

  const handleAdd = async (query: string): Promise<string | null> => {
    if (!account.address) {
      return 'Connect your wallet to add a subsidy';
    }
    if (!ethers.isAddress(query)) {
      return 'Enter a valid contract address';
    }
    const address = ethers.getAddress(query);
    const isSame = (other: string) => other.toLowerCase() === address.toLowerCase();
    if (getSubsidyProviderAddresses().some(isSame)) {
      return "This is the OPF subsidy. It's already shown above.";
    }
    if (subsidies.some((subsidy) => isSame(subsidy.address))) {
      return 'You already added this subsidy';
    }
    try {
      await addCustomSubsidy(address, await loadCustomSubsidyProgram(address));
    } catch (error) {
      return formatError({ error, fallback: "Couldn't read this contract. Try again later." });
    }
    return null;
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <LookupModal
        description="Add a subsidy contract by its address. It applies to your jobs once your wallet is on its access list."
        isOpen={addOpen}
        label="Subsidy contract address"
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
        placeholder="0x…"
        submitLabel="Add subsidy"
        title="Add subsidy"
      />
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h4>Other subsidies</h4>
          <span className={styles.muted}>Used before the OPF subsidy, on the nodes each one supports</span>
        </div>
        <Button color="accent1" contentBefore={<AddIcon />} onClick={() => setAddOpen(true)} size="md">
          Add subsidy
        </Button>
      </div>
      {subsidies.length === 0 ? (
        <span className={styles.small}>No subsidies added yet.</span>
      ) : (
        <div className={styles.blocks}>
          {subsidies.map((subsidy) => (
            <CustomSubsidyCard key={subsidy.address} onRemove={removeCustomSubsidy} subsidy={subsidy} />
          ))}
        </div>
      )}
    </Card>
  );
};

export default CustomSubsidies;
