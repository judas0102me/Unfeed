import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Body, Card, Heading, Screen } from '@/components/ui';
import { appStore } from '@/core/appStore';

export default function Onboarding() {
  const { t } = useTranslation();
  const accept = () => {
    appStore.setOnboarded();
    router.replace('/login');
  };
  return (
    <Screen scroll footer={<Button label={t('onboarding.accept')} onPress={accept} />}>
      <Heading>{t('onboarding.title')}</Heading>
      <Body>{t('onboarding.login')}</Body>
      <Body>{t('onboarding.how')}</Body>
      <Body>{t('onboarding.device')}</Body>
      <Card>
        <Body style={{ fontWeight: '600' }}>{t('onboarding.riskTitle')}</Body>
        <Body muted>{t('onboarding.risk')}</Body>
      </Card>
      <Card>
        <Body style={{ fontWeight: '600' }}>{t('onboarding.googleTitle')}</Body>
        <Body muted>{t('onboarding.google')}</Body>
      </Card>
    </Screen>
  );
}
