const reject = () => { throw new Error('Restore version compatibility verification failed.'); };

export function stableFcv(value: any): string {
  // Transitional FCV states must never be accepted as a matching stable version.
  if (!value || typeof value.version !== 'string' || Object.keys(value).some(key => key !== 'version') || !/^\d+\.\d+$/.test(value.version)) return reject();
  return value.version;
}

export function restoreVersionPolicy(sourceVersion: string, imageVersion: string, fcv: string, image: string, approval?: any) {
  if (!/^\d+\.\d+\.\d+$/.test(sourceVersion) || !/^\d+\.\d+\.\d+$/.test(imageVersion) || !/^\d+\.\d+$/.test(fcv) || !/^mongo@sha256:[a-f0-9]{64}$/.test(image)) return reject();
  let exception: string | null = null;
  if (sourceVersion !== imageVersion) {
    if (sourceVersion !== '8.0.36' || imageVersion !== '8.0.34' || fcv !== '8.0' ||
        approval?.approved !== true || approval.sourceVersion !== sourceVersion || approval.verifierVersion !== imageVersion ||
        approval.fcv !== fcv || approval.imageDigest !== image) return reject();
    exception = 'APPROVED_8.0.36_TO_8.0.34_ISOLATED_VERIFIER_ONLY';
  } else if (approval != null) return reject();
  return { productionVersion: sourceVersion, verifierVersion: imageVersion, fcv, pinnedImageDigest: image, exception };
}

export function verifyRestoreServer(policy: ReturnType<typeof restoreVersionPolicy>, actualVersion: string, actualFcv: any) {
  if (actualVersion !== policy.verifierVersion || stableFcv(actualFcv) !== policy.fcv) return reject();
}

export function databaseToolsVersion(output: string, tool: 'mongodump' | 'mongorestore') {
  const match = output.match(new RegExp(`^${tool} version: (\\d+\\.\\d+\\.\\d+)\\s*$`, 'm'));
  if (!match) return reject();
  return match[1];
}
