# Finance Brain: conexión de ejecución

## Estado de esta iteración

- Los RPC EVM soportados por el registro común son Ethereum, Arbitrum, Polygon y Base.
- El backend puede comprobar conectividad RPC y balances públicos de una dirección EVM sin custodiar claves.
- MetaMask se conecta en el navegador, informa cuenta/red y reacciona a cambios de cuenta o red.
- Todas las oportunidades siguen pasando por un único `ExecutionAdapter`.
- PAPER es el modo predeterminado. El gate LIVE permanece cerrado si no hay signer externo y un ejecutor específico.

## Qué significa “conectar todos los bots”

MetaMask solo cubre aprobación manual de transacciones EVM. No puede firmar un proceso autónomo del backend durante 24/7. La matriz real es:

| Bot | Mercado/red | Adaptador de ejecución necesario |
|---|---|---|
| Liquidation | Aave V3 / EVM | contrato ejecutor atómico + signer/vault |
| DEX Arbitrage | routers EVM | contrato atómico de arbitraje + aprobaciones seguras + signer/vault |
| Yield | protocolos DeFi EVM | adaptador por protocolo, depósitos/retiros y límites |
| Volatility / Momentum | Binance Spot | API de trading Binance con permisos mínimos |
| Perpetuals | Binance Futures | API Futures separada, leverage/margin y reduce-only |
| Solana Radar | Solana | signer Solana; MetaMask no es suficiente |
| Polymarket | Polygon CLOB | credenciales CLOB y signer compatible |
| Smart Money | lectura on-chain | genera señales; necesita estrategia de entrada antes de ejecutar |
| Allocator | coordinación | solo asigna después de recibir métricas de ejecuciones verificadas |

No se debe activar LIVE marcando una variable de entorno: primero hay que implementar, probar y auditar el adaptador de cada fila.
