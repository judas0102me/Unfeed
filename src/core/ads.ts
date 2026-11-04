// Anuncios de AdMob: identificadores, consentimiento e inicio del SDK.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, TestIds } from 'react-native-google-mobile-ads';

// null hasta crear los bloques en AdMob: sin identificador no se muestra ningún banner.
const PRODUCTION_BANNER_ID = Platform.select<string | null>({ android: null, ios: null, default: null });

export const BANNER_UNIT_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : PRODUCTION_BANNER_ID;

let ready = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAdsReady() {
  return useSyncExternalStore(subscribe, () => ready);
}

async function canRequestAds() {
  try {
    return (await AdsConsent.gatherConsent()).canRequestAds;
  } catch {
    // Falla si el mensaje de consentimiento no está configurado en AdMob o no hay red.
    return __DEV__ || (await AdsConsent.getConsentInfo()).canRequestAds;
  }
}

// El consentimiento va antes de initialize(): el SDK puede precargar anuncios al iniciar.
export async function initAds() {
  if (ready || !BANNER_UNIT_ID) return;
  try {
    if (!(await canRequestAds())) return;
    await mobileAds().initialize();
    ready = true;
    listeners.forEach(listener => listener());
  } catch (e) {
    if (__DEV__) console.warn('AdMob no pudo iniciar', e);
  }
}
