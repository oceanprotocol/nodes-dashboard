import axios from 'axios';

const apiUrl = 'https://ens-proxy.oceanprotocol.com/api';

export async function getEnsName(accountId: string) {
  if (!accountId || accountId === '') {
    return;
  }
  const response = await axios.get(`${apiUrl}/name?accountId=${accountId}`);
  return response.data?.name;
}

export async function getEnsAddress(accountId: string) {
  if (!accountId || accountId === '' || !accountId.includes('.')) {
    return;
  }
  const response = await axios.get(`${apiUrl}/address?name=${accountId}`);
  return response.data?.address;
}

export async function getEnsProfile(accountId: string) {
  if (!accountId || accountId === '') {
    return;
  }
  const response = await axios.get(`${apiUrl}/profile?address=${accountId}`);
  return response.data?.profile;
}
