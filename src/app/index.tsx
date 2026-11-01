// Punto de entrada: decide a qué pantalla ir según lo guardado en el teléfono.
import { Redirect } from 'expo-router';

import { appStore } from '@/core/appStore';

export default function Index() {
  if (!appStore.isOnboarded()) return <Redirect href="/onboarding" />;
  if (!appStore.account()) return <Redirect href="/login" />;
  return <Redirect href="/clean" />;
}
