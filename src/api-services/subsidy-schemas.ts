import { SubsidyDetails } from '@/types/subsidy';
import { WalletAuth } from '@/types/wallet-auth';
import * as Yup from 'yup';

const subsidyAuthShape = {
  expiryTimestamp: Yup.number().required(),
  signature: Yup.string().required(),
};

export const walletAddressBodySchema = Yup.object({
  ...subsidyAuthShape,
  walletAddress: Yup.string().required(),
});

export const subsidyDetailsBodySchema: Yup.ObjectSchema<SubsidyDetails & WalletAuth> = Yup.object({
  ...subsidyAuthShape,
  email: Yup.string().required(),
  handles: Yup.object({
    discord: Yup.string(),
    telegram: Yup.string(),
    x: Yup.string(),
  })
    .noUnknown()
    .required(),
  name: Yup.string().required(),
  walletAddress: Yup.string().required(),
});

export const subsidyVerifyBodySchema = Yup.object({
  ...subsidyAuthShape,
  code: Yup.string().required(),
  email: Yup.string(),
  walletAddress: Yup.string().required(),
});
