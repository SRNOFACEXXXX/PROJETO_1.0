import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Nav, Route } from './src/nav';
import { ConfirmSeed, CreateSeed, ImportWallet, SetPin, Welcome } from './src/screens/Onboarding';
import { Home, Receive } from './src/screens/Home';
import { Lock } from './src/screens/Lock';
import { Send } from './src/screens/Send';
import { Settings } from './src/screens/Settings';
import { currentKeys, hasWallet, lockWallet } from './src/session';
import { colors } from './src/theme';

/** Ao ir para segundo plano por mais que isto, a carteira se bloqueia sozinha. */
const AUTO_LOCK_MS = 30_000;

export default function App() {
  const [route, setRoute] = useState<Route | null>(null);
  const nav: Nav = useMemo(() => ({ go: setRoute }), []);

  useEffect(() => {
    hasWallet().then((has) => setRoute(has ? { name: 'lock' } : { name: 'welcome' }));
  }, []);

  const lockIfAway = useCallback(() => {
    if (currentKeys()) {
      lockWallet();
      setRoute({ name: 'lock' });
    }
  }, []);

  useEffect(() => {
    let leftAt = 0;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') leftAt = Date.now();
      if (st === 'active' && leftAt && Date.now() - leftAt > AUTO_LOCK_MS) lockIfAway();
      if (st === 'active') leftAt = 0;
    });
    return () => sub.remove();
  }, [lockIfAway]);

  // Rotas que exigem carteira desbloqueada nunca renderizam sem chaves.
  const guarded = route && ['home', 'receive', 'send', 'settings'].includes(route.name) && !currentKeys();
  const r: Route | null = guarded ? { name: 'lock' } : route;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {r === null ? null : r.name === 'welcome' ? (
          <Welcome nav={nav} />
        ) : r.name === 'create' ? (
          <CreateSeed nav={nav} />
        ) : r.name === 'confirm' ? (
          <ConfirmSeed nav={nav} mnemonic={r.mnemonic} />
        ) : r.name === 'setpin' ? (
          <SetPin nav={nav} mnemonic={r.mnemonic} />
        ) : r.name === 'import' ? (
          <ImportWallet nav={nav} />
        ) : r.name === 'lock' ? (
          <Lock nav={nav} />
        ) : r.name === 'home' ? (
          <Home nav={nav} />
        ) : r.name === 'receive' ? (
          <Receive nav={nav} />
        ) : r.name === 'send' ? (
          <Send nav={nav} />
        ) : (
          <Settings nav={nav} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
