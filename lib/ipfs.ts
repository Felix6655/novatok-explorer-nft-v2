export function ipfsToHttp(ipfsUri: string) {
  if (!ipfsUri.startsWith("ipfs://")) return ipfsUri;
  return `https://ipfs.io/ipfs/${ipfsUri.replace("ipfs://", "")}`;
}
