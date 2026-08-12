'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import BucketAccess from '@/components/node-storage/bucket-access';
import { MAX_BUCKET_NAME_LENGTH, useNodeStorage } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { BucketAccessState, StorageNode } from '@/types/node-storage';
import { formatError } from '@/utils/formatters';
import { peerIdToStorageNode } from '@/utils/node-storage';
import { isAddress } from 'ethers';
import { useFormik } from 'formik';
import React from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './create-bucket-modal.module.css';

type CreateBucketModalProps = {
  isOpen: boolean;
  /** Omit to let the user type the node's peer ID — the account-wide storage view has no node in hand. */
  node?: StorageNode;
  onClose: () => void;
  onSave?: (node: StorageNode) => void;
};

type CreateBucketFormValues = {
  access: BucketAccessState;
  label: string;
  nodeId: string;
};

const CreateBucketModalInner: React.FC<CreateBucketModalProps> = ({ node, onClose, onSave }) => {
  const { account, provider } = useOceanAccount();
  const { createBucket } = useNodeStorage();

  const formik = useFormik<CreateBucketFormValues>({
    initialValues: {
      access: { mode: 'new', wallets: [account.address!] },
      label: '',
      nodeId: '',
    },
    validationSchema: Yup.object({
      label: Yup.string().max(MAX_BUCKET_NAME_LENGTH, 'Name is too long'),
      nodeId: node ? Yup.string() : Yup.string().trim().required('Node ID is required'),
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
          if (value.mode === 'none') {
            return true;
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
          if (!provider) {
            return true;
          }
          try {
            const code = await provider.getCode(addr);
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
      const target = node ?? peerIdToStorageNode(values.nodeId.trim());
      try {
        await createBucket({
          nodeId: target.nodeId,
          nodeUri: target.nodeUri,
          access: values.access,
          label: values.label.trim() || undefined,
        });
        toast.success('Bucket created');
        onClose();
        onSave?.(target);
      } catch (e: any) {
        toast.error(formatError({ error: e, fallback: 'Your bucket could not be created.' }));
      }
    },
  });

  const accessError = formik.touched.access && formik.errors.access ? (formik.errors.access as string) : undefined;

  return (
    <form className={styles.form} onSubmit={formik.handleSubmit}>
      {node ? (
        <div className={styles.infoRow}>
          <div className="textSecondary">Node:</div>
          {node.friendlyName ? (
            <div>
              <strong>{node.friendlyName}</strong>
              <div className="textSecondary">{node.nodeId}</div>
            </div>
          ) : (
            <div>{node.nodeId}</div>
          )}
        </div>
      ) : (
        <Input
          type="text"
          label="Node ID"
          name="nodeId"
          placeholder="Enter node peer ID"
          size="md"
          value={formik.values.nodeId}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorText={formik.touched.nodeId && formik.errors.nodeId ? (formik.errors.nodeId as string) : undefined}
        />
      )}
      <Input
        type="text"
        label="Name"
        name="label"
        placeholder="Leave blank for an auto-generated name"
        size="md"
        value={formik.values.label}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        errorText={formik.touched.label && formik.errors.label ? (formik.errors.label as string) : undefined}
      />
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
  );
};

const CreateBucketModal: React.FC<CreateBucketModalProps> = ({ isOpen, node, onClose, onSave }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create bucket" width="md" fullWidth>
      <CreateBucketModalInner isOpen={isOpen} node={node} onClose={onClose} onSave={onSave} />
    </Modal>
  );
};

export default CreateBucketModal;
