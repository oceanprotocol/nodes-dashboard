'use client';

import Button from '@/components/button/button';
import Modal from '@/components/modal/modal';
import BucketAccess from '@/components/node-storage/bucket-access';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { BucketAccessState } from '@/types/node-storage';
import { Node } from '@/types/nodes';
import { isAddress } from 'ethers';
import { useFormik } from 'formik';
import React, { useRef } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './create-bucket-modal.module.css';

type CreateBucketModalProps = {
  isOpen: boolean;
  node: Node;
  onClose: () => void;
  onSave?: () => void;
};

type CreateBucketFormValues = {
  access: BucketAccessState;
};

const CreateBucketModal: React.FC<CreateBucketModalProps> = ({ isOpen, node, onClose, onSave }) => {
  const { account, provider } = useOceanAccount();
  const { createBucket } = useNodeStorage();

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const nodeId = node.id ?? node.nodeId ?? '';
  const friendlyName = node.friendlyName ?? nodeId;
  const nodeUri = node.currentAddrs?.length ? node.currentAddrs : nodeId;

  const formik = useFormik<CreateBucketFormValues>({
    initialValues: {
      access: { mode: 'new', wallets: [account.address!] },
    },
    validationSchema: Yup.object({
      access: Yup.mixed<BucketAccessState>()
        .required()
        .test('access-valid', 'Access list contract address is required', (value) => {
          if (!value) {
            return false;
          }
          if (value.mode === 'existing') {
            return Boolean(value.address.trim());
          }
          if (value.mode === 'new') {
            return value.wallets.length > 0;
          }
          return false;
        })
        .test('access-existing-format', 'Invalid Ethereum address', (value) => {
          if (!value || value.mode !== 'existing') {
            return true;
          }
          const addr = value.address.trim();
          return !addr || isAddress(addr);
        })
        .test('access-existing-contract', 'Address is not a deployed contract', async (value) => {
          if (!value || value.mode !== 'existing') {
            return true;
          }
          const addr = value.address.trim();
          if (!addr || !isAddress(addr)) {
            return true;
          }
          const p = providerRef.current;
          if (!p) {
            return true;
          }
          try {
            const code = await p.getCode(addr);
            return code !== '0x';
          } catch {
            return true;
          }
        })
        .test('access-new-wallets', 'Add at least one wallet address', (value) => {
          if (!value) {
            return false;
          }
          if (value.mode === 'new') {
            return value.wallets.length > 0;
          }
          return true;
        }),
    }),
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      try {
        await createBucket({ nodeId, nodeUri, access: values.access });
        toast.success('Bucket created');
        onClose();
        onSave?.();
      } catch (e: any) {
        toast.error(e?.message ?? 'Failed to create bucket');
      }
    },
  });

  const accessError = formik.touched.access && formik.errors.access ? (formik.errors.access as string) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create bucket" width="md" fullWidth>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <div className={styles.infoRow}>
          <div className="textSecondary">Node:</div>
          {friendlyName ? (
            <div>
              <strong>{friendlyName}</strong>
              <div className="textSecondary">{nodeId}</div>
            </div>
          ) : (
            <div>{nodeId}</div>
          )}
        </div>
        <BucketAccess
          value={formik.values.access}
          onChange={(v) => {
            formik.setFieldValue('access', v);
            formik.setFieldTouched('access', true, false);
          }}
          currentAccount={account?.address}
          error={accessError}
        />
        <div className="actionsGroupMdEnd">
          <Button
            color="accent1"
            disabled={formik.isSubmitting}
            onClick={onClose}
            size="md"
            variant="outlined"
            type="button"
          >
            Cancel
          </Button>
          <Button color="accent1" loading={formik.isSubmitting} size="md" variant="filled" type="submit">
            {formik.isSubmitting ? 'Creating…' : 'Create bucket'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateBucketModal;
