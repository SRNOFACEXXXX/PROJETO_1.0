import {
  InsufficientFundsError,
  InvalidTransactionError,
  MempoolExplorer,
  buildAndSign,
  evaluateSpend,
  DEFAULT_POLICY,
  type FeeEstimates,
  type SignedTransaction,
} from '@brbit/wallet-core';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatBtc, parseBtcToSats, shortAddress } from '../format';
import type { Nav } from '../nav';
import { currentKeys, verifyPin } from '../session';
import { colors } from '../theme';
import { Banner, Body, Card, Field, Mono, NeonButton, PIN_LENGTH, PinPad, Screen, Title } from '../ui';
import { SyncBanner, useWallet } from './Home';

type Step = 'form' | 'review' | 'pin' | 'done';
type Speed = 'economy' | 'hour' | 'halfHour';
const SPEEDS: { key: Speed; label: string }[] = [
  { key: 'economy', label: 'Econômica' },
  { key: 'hour', label: 'Normal' },
  { key: 'halfHour', label: 'Rápida' },
];

export function Send({ nav }: { nav: Nav }) {
  const keys = currentKeys();
  const wallet = useWallet();
  const state = wallet.state;
  const loading = wallet.status === 'loading';
  const [step, setStep] = useState<Step>('form');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [speed, setSpeed] = useState<Speed>('hour');
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [signedPreview, setSigned] = useState<SignedTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [txid, setTxid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!keys) return;
    new MempoolExplorer(keys.network.explorerApi, fetch as never)
      .getFees()
      .then(setFees)
      .catch(() => setError('Não foi possível obter as taxas. Tente novamente.'));
  }, [keys]);

  if (!keys) return null;
  const unit = keys.network.name === 'testnet' ? 'tBTC' : 'BTC';
  const feeRate = fees ? Math.max(1, fees[speed]) : 0;

  /** Monta a transação (sem enviar) para mostrar os valores reais na revisão. */
  function build(): SignedTransaction | null {
    const sats = parseBtcToSats(amount);
    if (!keys || !state) return null;
    if (sats === null) {
      setError('Valor inválido. Use até 8 casas decimais.');
      return null;
    }
    if (!fees) {
      setError('Taxas indisponíveis.');
      return null;
    }
    const decision = evaluateSpend(DEFAULT_POLICY, { origin: 'user', to, amountSats: sats, feeRate }, [], Date.now());
    if (decision.decision === 'deny') {
      setError(decision.reasons.join(' '));
      return null;
    }
    try {
      return buildAndSign({
        keys,
        utxos: state.utxos,
        to: to.trim(),
        amountSats: sats,
        feeRate,
        changeAddress: state.nextChange,
      });
    } catch (e) {
      if (e instanceof InsufficientFundsError) {
        setError(`Saldo insuficiente. Precisa de ${formatBtc(e.needed)} ${unit} (valor + taxa).`);
      } else if (e instanceof InvalidTransactionError) {
        setError(e.message);
      } else {
        setError('Não foi possível montar a transação.');
      }
      return null;
    }
  }

  function review() {
    setError(null);
    const t = build();
    if (t) {
      setSigned(t);
      setStep('review');
    }
  }

  async function onPin(v: string) {
    if (busy) return;
    setPin(v);
    setError(null);
    if (v.length < PIN_LENGTH) return;
    setBusy(true);
    try {
      const r = await verifyPin(v);
      if (!r.ok) {
        setPin('');
        setError(r.reason === 'wrong' ? 'PIN incorreto.' : r.reason === 'locked' ? 'Bloqueado por tentativas.' : 'Carteira apagada.');
        if (r.reason === 'wiped') nav.go({ name: 'welcome' });
        return;
      }
      // Reconstrói a transação no momento do envio, com o estado atual.
      const t = build();
      if (!t) return setStep('form');
      const id = await new MempoolExplorer(keys!.network.explorerApi, fetch as never).broadcast(t.hex);
      setTxid(id);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'pin') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Title>Autorizar envio</Title>
            <Body muted>{busy ? 'Assinando e enviando…' : 'Digite seu PIN para assinar.'}</Body>
          </View>
          <PinPad value={pin} onChange={onPin} error={!!error} />
          {error ? <Banner kind="danger">{error}</Banner> : null}
          <NeonButton title="Cancelar" variant="ghost" onPress={() => setStep('review')} />
        </View>
      </Screen>
    );
  }

  if (step === 'done') {
    return (
      <Screen>
        <Title color={colors.lime}>Enviado ✓</Title>
        <Body muted>A transação foi transmitida à rede. Ela aparece como pendente até ser confirmada.</Body>
        <Card accent={colors.lime}>
          <Body muted>ID da transação</Body>
          <Mono color={colors.lime} size={12}>{txid}</Mono>
        </Card>
        <NeonButton testID="btn-done" title="Concluir" onPress={() => nav.go({ name: 'home' })} />
      </Screen>
    );
  }

  if (step === 'review' && signedPreview) {
    const total = signedPreview.amountSats + signedPreview.feeSats;
    return (
      <Screen>
        <Title>Revise o envio</Title>
        <Card accent={colors.magenta}>
          <Body muted>Para</Body>
          <Mono size={13}>{signedPreview.to}</Mono>
          <Body muted>Valor</Body>
          <Mono color={colors.cyan} size={18}>{formatBtc(signedPreview.amountSats)} {unit}</Mono>
          <Body muted>Taxa de rede ({feeRate} sat/vB)</Body>
          <Mono size={15}>{formatBtc(signedPreview.feeSats)} {unit}</Mono>
          <Body muted>Total debitado</Body>
          <Mono color={colors.magenta} size={18}>{formatBtc(total)} {unit}</Mono>
        </Card>
        {keys.network.name === 'mainnet' ? <Banner kind="danger">MAINNET: dinheiro real. Confira o endereço.</Banner> : null}
        <Body muted style={{ fontSize: 12 }}>Destino: {shortAddress(signedPreview.to)}. Envios são irreversíveis.</Body>
        <NeonButton testID="btn-authorize" title="Autorizar com PIN" onPress={() => { setPin(''); setError(null); setStep('pin'); }} />
        <NeonButton title="Editar" variant="ghost" onPress={() => setStep('form')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Enviar</Title>
      <Body muted>
        Disponível: {state ? formatBtc(state.confirmedSats) : loading ? '…' : '—'} {unit}
      </Body>
      <Field testID="send-to" label="Endereço de destino" value={to} onChangeText={(t) => { setTo(t); setError(null); }} placeholder={keys.network.name === 'testnet' ? 'tb1q…' : 'bc1q…'} />
      <Field testID="send-amount" label={`Valor (${unit})`} value={amount} onChangeText={(t) => { setAmount(t); setError(null); }} placeholder="0.00010000" keyboardType="decimal-pad" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>VELOCIDADE</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SPEEDS.map((sp) => (
            <View key={sp.key} style={{ flex: 1 }}>
              <NeonButton
                title={sp.label}
                variant={speed === sp.key ? 'primary' : 'ghost'}
                onPress={() => setSpeed(sp.key)}
              />
            </View>
          ))}
        </View>
        <Body muted style={{ fontSize: 12 }}>{fees ? `${feeRate} sat/vB` : 'Carregando taxas…'}</Body>
      </View>
      {!state && !loading ? (
        <>
          <Banner kind="warn">Sem resposta do servidor: não dá para enviar agora, porque o app precisa conferir seus saldos na rede.</Banner>
          <SyncBanner status={wallet.status} error={wallet.error} retryIn={wallet.retryIn} />
          <NeonButton testID="btn-send-retry" title="Tentar agora" variant="ghost" onPress={wallet.refresh} />
        </>
      ) : null}
      {error ? <Banner kind="danger">{error}</Banner> : null}
      <NeonButton testID="btn-review" title="Revisar" disabled={!state || !fees || !to || !amount} onPress={review} />
      <NeonButton title="Voltar" variant="ghost" onPress={() => nav.go({ name: 'home' })} />
    </Screen>
  );
}
