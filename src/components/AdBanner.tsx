// Banner adaptable anclado. No ocupa espacio hasta que hay consentimiento y anuncio disponible.
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize, useForeground } from 'react-native-google-mobile-ads';

import { BANNER_UNIT_ID, useAdsReady } from '@/core/ads';
import { spacing } from '@/theme/colors';

export function AdBanner() {
  const ready = useAdsReady();
  const banner = useRef<BannerAd>(null);
  const [failed, setFailed] = useState(false);

  // En iOS el banner puede quedar vacío al volver de segundo plano: se pide uno nuevo.
  useForeground(() => {
    if (Platform.OS === 'ios') banner.current?.load();
  });

  if (!ready || !BANNER_UNIT_ID || failed) return null;
  return (
    <View style={styles.slot}>
      <BannerAd
        ref={banner}
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', paddingTop: spacing.sm },
});
