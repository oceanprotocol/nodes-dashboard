import { createAuthToken, getNonce } from "@/services/nodeService";
import { ethers, JsonRpcSigner, Signer, toUtf8Bytes } from "ethers";

export async function generateAuthTokenWithSmartAccount(peerId: string, address: string, signMessageAsync: any) {
    const nonce = await getNonce(peerId, address);
    const incrementedNonce = (nonce + 1).toString();
    const messageToSign = address + incrementedNonce;
    const signedMessage = await signMessageAsync({
      message: messageToSign,
    });
    const token = await createAuthToken(peerId, address, signedMessage, incrementedNonce);
    return token;
}