import { MarketClient } from '@brbit/wallet-core';

/** Cliente único de dados de mercado (compartilha o limite de requisições entre as telas). */
export const marketClient = new MarketClient(fetch as never);
