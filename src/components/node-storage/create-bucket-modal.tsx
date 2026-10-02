'use client';

import Button from '@/components/button/button';
import { useNodeBucketSharing } from '@/components/hooks/use-node-bucket-sharing';
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
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './create-bucket-modal.module.css';

type CreateBucketModalProps = {
  isOpen: boolean;
  /** Omit to let the user type the node's peer ID — the account-wide storage view has no node in hand. */
  node?: StorageNode;
  onClose: () => void;
  /** Both the node the bucket landed on and the bucket itself: callers need one or the other. */
  onSave?: (node: StorageNode, bucket: { bucketId: string }) => void;
};

type CreateBucketFormValues = {
  access: BucketAccessState;
  label: string;
  nodeId: string;
};

const CreateBucketModalInner: React.FC<CreateBucketModalProps> = ({ node, onClose, onSave }) => {
  const { account, provider } = useOceanAccount();
  const { createBucket } = useNodeStorage();
  // Debounce dialing while typing; pasting a peer ID does not require leaving the field.
  const [typedNodeId, setTypedNodeId] = useState('');
  const sharingNode = useMemo(
    () => node ?? (typedNodeId ? peerIdToStorageNode(typedNodeId) : null),
    [node, typedNodeId]
  );
  const { sharing, loading: checkingSharing, error: sharingError, retry } = useNodeBucketSharing(sharingNode);
  const sharingDisabled = sharing === 'disabled';

  const formik = useFormik<CreateBucketFormValues>({
    initialValues: {
      access: { mode: 'none' },
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
      if (!sharingReady) return;
      const target = node ?? peerIdToStorageNode(values.nodeId.trim());
      try {
        const bucket = await createBucket({
          nodeId: target.nodeId,
          nodeUri: target.nodeUri,
          access: sharingDisabled ? { mode: 'none' } : values.access,
          label: values.label.trim() || undefined,
        });
        toast.success('Bucket created');
        onClose();
        onSave?.(target, bucket);
      } catch (e: any) {
        toast.error(formatError({ error: e, fallback: 'Your bucket could not be created.' }));
      }
    },
  });

  const enteredNodeId = formik.values.nodeId.trim();
  useEffect(() => {
    const timer = setTimeout(() => setTypedNodeId(enteredNodeId), 450);
    return () => clearTimeout(timer);
  }, [enteredNodeId]);
  const waitingForNode = !node && (!enteredNodeId || enteredNodeId !== typedNodeId);
  const sharingReady =
    !waitingForNode && !checkingSharing && !sharingError && (sharing === 'allowed' || sharing === 'disabled');

  // The node refuses a bucket with an access list while sharing is off, so fall back to owner-only.
  const { setFieldValue } = formik;
  const accessMode = formik.values.access.mode;
  useEffect(() => {
    if (sharingDisabled && accessMode !== 'none') {
      setFieldValue('access', { mode: 'none' });
    }
  }, [accessMode, setFieldValue, sharingDisabled]);

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
      {!sharingReady ? (
        <div role="status" className="textSecondary">
          {waitingForNode
            ? 'Enter a node ID to check bucket access.'
            : sharingError
              ? 'Could not check this node’s storage settings.'
              : sharing === 'unavailable'
                ? 'Persistent storage is not available on this node.'
                : 'Checking bucket access…'}
          {sharingError && !waitingForNode ? (
            <Button onClick={retry} size="sm" variant="transparent">
              Try again
            </Button>
          ) : null}
        </div>
      ) : (
        <BucketAccess
          value={formik.values.access}
          onChange={(v) => {
            formik.setFieldValue('access', v);
            formik.setFieldTouched('access', true, false);
          }}
          currentAccount={account?.address}
          error={accessError}
          sharingDisabled={sharingDisabled}
        />
      )}
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
        <Button
          color="accent1"
          disabled={!sharingReady}
          loading={formik.isSubmitting}
          size="md"
          variant="filled"
          type="submit"
        >
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
