import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDuration } from '../format';
import type { Nav } from '../nav';
import { unlockWallet } from '../session';
import { colors, fonts } from '../theme';
import { Banner, H1, P, PIN_LENGTH, PinPad, Screen } from '../ui';

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
      if (r.lockedMs > 0) {
        // Esta tentativa errada acionou o bloqueio: avisa já, sem esperar a próxima tentativa.
        setUntil(Date.now() + r.lockedMs);
        setNow(Date.now());
        setMsg('Muitas tentativas. Aguarde para tentar de novo.');
      } else {
        setMsg(`PIN incorreto (${r.failures} erro${r.failures > 1 ? 's' : ''}).`);
      }
    } else {
      nav.go({ name: 'welcome' });
    }
  }

  return (
    <Screen scroll={false} glowAt="top">
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <View style={{ gap: 10, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: colors.green }}>B</Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>BR Bit</Text>
          </View>
          <H1 style={{ fontSize: 32, textAlign: 'center' }}>Digite seu PIN</H1>
          <P small style={{ textAlign: 'center' }}>{busy ? 'Abrindo a carteira…' : 'Sua carteira está bloqueada.'}</P>
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
