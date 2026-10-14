import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Trata o botão Voltar do Android dentro de uma tela. Devolva `true` se a tela tratou
 * (ex.: voltou um passo interno) ou `false` para deixar a navegação padrão agir.
 * O React Native consulta os ouvintes do mais recente para o mais antigo.
 */
export function useBack(handler: () => boolean): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => ref.current());
    return () => sub.remove();
  }, []);
}
