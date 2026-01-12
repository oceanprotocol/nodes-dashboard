import { JobInfoModal } from '@/components/modal/job-info-modal';
import { ComputeJob } from '@/types/jobs';
import { useState } from 'react';
import Button from './button';

interface JobInfoButtonProps {
  job: ComputeJob;
}

export const JobInfoButton = ({ job }: JobInfoButtonProps) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Button color="accent1" variant="outlined" onClick={handleOpen}>
        Job Info
      </Button>
      <JobInfoModal job={job} open={open} onClose={handleClose} />
    </>
  );
};

export default JobInfoButton;
