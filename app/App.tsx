import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { backTarget, type Nav, type Route } from './src/nav';
import { Activity } from './src/screens/Activity';
import { Home, Receive } from './src/screens/Home';
import { Lock } from './src/screens/Lock';
import { MarketDetail, Markets } from './src/screens/Markets';
import { ConfirmSeed, CreateSeed, ImportWallet, Ready, SeedNotice, SetPin, Welcome } from './src/screens/Onboarding';
import { Send } from './src/screens/Send';
import { Settings, ViewKey } from './src/screens/Settings';
import { currentKeys, hasWallet, lockWallet } from './src/session';
import { colors } from './src/theme';

/** Ao ir para segundo plano por mais que isto, a carteira se bloqueia sozinha. */
const AUTO_LOCK_MS = 30_000;

/** Rotas que usam chaves da carteira: nunca renderizam sem a carteira desbloqueada. */
const NEEDS_KEYS = new Set<Route['name']>(['home', 'receive', 'send', 'settings', 'viewkey', 'activity']);

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const [route, setRoute] = useState<Route | null>(null);
  const nav: Nav = useMemo(() => ({ go: setRoute }), []);
  const routeRef = useRef<Route | null>(null);

  // Botão Voltar do Android: volta uma tela; só as telas raiz deixam o sistema fechar o app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const target = routeRef.current ? backTarget(routeRef.current) : null;
      if (!target) return false;
      setRoute(target);
      return true;
    });
    return () => sub.remove();
  }, []);

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

  // Sem as fontes não há o que mostrar; se falharem, segue com as do sistema (nunca trava).
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const guarded = route && NEEDS_KEYS.has(route.name) && !currentKeys();
  const r: Route | null = guarded ? { name: 'lock' } : route;
  routeRef.current = r;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {r === null ? null : r.name === 'welcome' ? (
          <Welcome nav={nav} />
        ) : r.name === 'aviso' ? (
          <SeedNotice nav={nav} />
        ) : r.name === 'create' ? (
          <CreateSeed nav={nav} initial={r.mnemonic} />
        ) : r.name === 'confirm' ? (
          <ConfirmSeed nav={nav} mnemonic={r.mnemonic} />
        ) : r.name === 'setpin' ? (
          <SetPin nav={nav} mnemonic={r.mnemonic} isNew={r.isNew} />
        ) : r.name === 'ready' ? (
          <Ready nav={nav} isNew={r.isNew} />
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
        ) : r.name === 'markets' ? (
          <Markets nav={nav} />
        ) : r.name === 'market' ? (
          <MarketDetail nav={nav} symbol={r.symbol} />
        ) : r.name === 'activity' ? (
          <Activity nav={nav} />
        ) : r.name === 'viewkey' ? (
          <ViewKey nav={nav} />
        ) : (
          <Settings nav={nav} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
