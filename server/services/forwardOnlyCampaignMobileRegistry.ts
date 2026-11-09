export const FORWARD_ONLY_REGISTRY_MODE = 'forward-only' as const;
export const FORWARD_ONLY_REGISTRY_VERSION = 2 as const;
export const CAMPAIGN_MOBILE_STATE_ID = 'campaign-mobile-v1' as const;

export function buildForwardOnlyReadinessMarker(activatedAt = new Date()) {
  return {
    _id: CAMPAIGN_MOBILE_STATE_ID,
    mode: FORWARD_ONLY_REGISTRY_MODE,
    version: FORWARD_ONLY_REGISTRY_VERSION,
    ready: true,
    // Historical leads are intentionally not imported or represented as covered.
    coverageVerified: false,
    historicalCoverage: 'not-imported' as const,
    uniqueIndexVerified: true,
    transactionTopologyVerified: true,
    activatedAt,
  };
}

export function isForwardOnlyRegistryReady(state: any): boolean {
  return Boolean(state
    && state._id === CAMPAIGN_MOBILE_STATE_ID
    && state.mode === FORWARD_ONLY_REGISTRY_MODE
    && state.version === FORWARD_ONLY_REGISTRY_VERSION
    && state.ready === true
    && state.coverageVerified === false
    && state.historicalCoverage === 'not-imported'
    && state.uniqueIndexVerified === true
    && state.transactionTopologyVerified === true
    && state.activatedAt != null
    && Number.isFinite(new Date(state.activatedAt).getTime()));
}
