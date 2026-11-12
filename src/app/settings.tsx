import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Card, Heading, OptionRow, Screen, TextLink } from '@/components/ui';
import { appStore, Speed } from '@/core/appStore';

export default function Settings() {
  const { t } = useTranslation();
  const [speed, setSpeed] = useState(appStore.speed);
  const [dryRun, setDryRun] = useState(appStore.dryRun);
  const account = appStore.account();

  const chooseSpeed = (value: Speed) => {
    appStore.setSpeed(value);
    setSpeed(value);
  };
  const toggleDryRun = () => {
    appStore.setDryRun(!dryRun);
    setDryRun(!dryRun);
  };
  const logout = () =>
    Alert.alert(t('settings.logout'), account ? `@${account.handle}` : undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: () => router.replace({ pathname: '/login', params: { logout: '1' } }),
      },
    ]);

  return (
    <Screen scroll ad>
      <TextLink label={t('common.back')} onPress={() => router.back()} />
      <Heading>{t('settings.title')}</Heading>

      <Card>
        <Body strong>{t('settings.speed')}</Body>
        <View>
          <OptionRow kind="radio" label={t('settings.speedNormal')} selected={speed === 'normal'} onPress={() => chooseSpeed('normal')} />
          <OptionRow kind="radio" label={t('settings.speedCareful')} selected={speed === 'careful'} onPress={() => chooseSpeed('careful')} />
        </View>
        <Body muted>{t('settings.speedHint')}</Body>
      </Card>

      <Card>
        <Body strong>{t('settings.language')}</Body>
        <Body muted>{t('settings.languageHint')}</Body>
        <TextLink label={t('settings.languageOpen')} onPress={() => Linking.openSettings()} />
      </Card>

      {account && (
        <Card>
          <Body strong>{t('settings.account')}</Body>
          <Body muted>@{account.handle}</Body>
          <Button label={t('settings.logout')} variant="danger" onPress={logout} />
        </Card>
      )}

      <Card>
        <Body strong>{t('settings.privacy')}</Body>
        <Body muted>{t('settings.privacyText')}</Body>
      </Card>

      {__DEV__ && (
        <Card>
          <Body strong>{t('settings.dev')}</Body>
          <OptionRow label={t('settings.dryRun')} selected={dryRun} onPress={toggleDryRun} />
          <TextLink label={t('settings.debug')} onPress={() => router.push('/debug')} />
        </Card>
      )}
    </Screen>
  );
}
