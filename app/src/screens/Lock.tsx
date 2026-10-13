import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDuration } from '../format';
import type { Nav } from '../nav';
import { unlockWallet } from '../session';
import { colors } from '../theme';
import { Banner, Body, PIN_LENGTH, PinPad, Screen, Title } from '../ui';

export function Lock({ nav }: { nav: Nav }) {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);

  const remaining = Math.max(0, until - now);

  async function onChange(v: string) {
    if (busy || remaining > 0) return;
    setPin(v);
    setMsg(null);
    if (v.length < PIN_LENGTH) return;
    setBusy(true);
    const r = await unlockWallet(v);
    setPin('');
    setBusy(false);
    if (r.ok) return nav.go({ name: 'home' });
    if (r.reason === 'locked') {
      setUntil(Date.now() + r.remainingMs);
      setNow(Date.now());
      setMsg('Muitas tentativas. Aguarde para tentar de novo.');
    } else if (r.reason === 'wrong') {
      setMsg(`PIN incorreto (${r.failures} erro${r.failures > 1 ? 's' : ''}).`);
    } else if (r.reason === 'wiped') {
      nav.go({ name: 'welcome' });
    } else {
      nav.go({ name: 'welcome' });
    }
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <View style={{ gap: 8, alignItems: 'center' }}>
          <Text style={{ color: colors.cyan, letterSpacing: 6, fontWeight: '800' }}>BR BIT</Text>
          <Title>Digite seu PIN</Title>
          <Body muted>{busy ? 'Abrindo a carteira…' : 'Sua carteira está bloqueada.'}</Body>
        </View>
        <PinPad value={pin} onChange={onChange} error={!!msg} />
        {remaining > 0 ? (
          <Banner kind="warn">Bloqueado por {formatDuration(remaining)}.</Banner>
        ) : msg ? (
          <Banner kind="danger">{msg}</Banner>
        ) : null}
      </View>
    </Screen>
  );
}
