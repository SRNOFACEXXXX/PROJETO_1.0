import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, glow, mono, radius, space } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={s.scroll}>{children}</View>
  );
  return (
    <LinearGradient colors={[colors.bg, colors.bg2, colors.bg]} style={s.flex}>
      <SafeAreaView style={s.flex}>{body}</SafeAreaView>
    </LinearGradient>
  );
}

export function Title({ children, color = colors.text }: { children: ReactNode; color?: string }) {
  return <Text style={[s.title, { color }]}>{children}</Text>;
}

export function Body({ children, muted = false, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[s.body, muted && { color: colors.muted }, style]}>{children}</Text>;
}

export function Card({ children, accent, style }: { children: ReactNode; accent?: string; style?: ViewStyle }) {
  return (
    <View style={[s.card, accent ? { borderColor: accent, ...glow(accent, 0.35) } : null, style]}>{children}</View>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function NeonButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const tone = variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.magenta : colors.cyan;
  const filled = variant === 'primary' || variant === 'danger' || variant === 'secondary';
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        variant === 'ghost' ? { borderColor: colors.border } : { borderColor: tone, ...glow(tone, off ? 0 : 0.7) },
        filled && { backgroundColor: tone + (pressed ? '55' : '22') },
        off && { opacity: 0.45 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone} />
      ) : (
        <Text style={[s.btnText, { color: variant === 'ghost' ? colors.muted : tone }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
        style={[s.input, rest.multiline && { minHeight: 110, textAlignVertical: 'top' }, rest.style]}
      />
    </View>
  );
}

export function Banner({ kind, children }: { kind: 'warn' | 'danger' | 'info'; children: ReactNode }) {
  const c = kind === 'danger' ? colors.danger : kind === 'warn' ? colors.warn : colors.cyan;
  return (
    <View style={[s.banner, { borderColor: c, backgroundColor: c + '14' }]}>
      <Text style={[s.body, { color: c, fontSize: 13 }]}>{children}</Text>
    </View>
  );
}

export const PIN_LENGTH = 6;

/** Teclado numérico próprio: evita teclado do sistema e mantém o PIN fora de autofill. */
export function PinPad({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const press = (d: string) => value.length < PIN_LENGTH && onChange(value + d);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <View style={{ flexDirection: 'row', gap: 14 }} accessibilityLabel={`${value.length} de ${PIN_LENGTH} dígitos`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const on = i < value.length;
          const c = error ? colors.danger : colors.cyan;
          return (
            <View
              key={i}
              style={[s.dot, on ? { backgroundColor: c, borderColor: c, ...glow(c, 0.8) } : { borderColor: colors.border }]}
            />
          );
        })}
      </View>
      <View style={s.pad}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={s.key} />
          ) : (
            <Pressable
              key={i}
              testID={k === '⌫' ? 'pin-back' : `pin-${k}`}
              accessibilityLabel={k === '⌫' ? 'apagar' : k}
              onPress={() => (k === '⌫' ? onChange(value.slice(0, -1)) : press(k))}
              style={({ pressed }) => [s.key, s.keyBtn, pressed && { backgroundColor: colors.cyan + '22' }]}
            >
              <Text style={s.keyText}>{k}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

export function Mono({ children, color = colors.text, size = 14 }: { children: ReactNode; color?: string; size?: number }) {
  return <Text selectable style={{ fontFamily: mono, color, fontSize: size, letterSpacing: 0.3 }}>{children}</Text>;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: space.lg, gap: space.md },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: 0.5 },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  btn: {
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: mono,
  },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  pad: { width: 270, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  key: { width: 80, height: 62 },
  keyBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: colors.text, fontSize: 24, fontWeight: '700' },
});
