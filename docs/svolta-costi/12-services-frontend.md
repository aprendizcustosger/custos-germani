# Capítulo 12 — Services Frontend

## 12.1 Catálogo de services
Este capítulo documenta a interface efetiva de `src/services/api.js`.

| Service | Método | Ação |
|---------|--------|------|
| api | signIn(login, password) | Login por e-mail/senha |
| api | signInWithMasterBootstrap(login, password) | Bootstrap do master |
| api | signOut() | Encerrar sessão |
| api | getCurrentUser() | Obter usuário atual |
| api | getMasters() | Carregar dimensões e dicionário |
| api | upsertHistoricoCustos(payload) | Gravar histórico por upsert |
| api | getHistorico(filters) | Consultar histórico filtrado |
| api | getTrendsByProduct(codigoProduto) | Série temporal por produto |

## 12.2 Interface TypeScript de referência
Abaixo está a interface de referência para tipagem futura.

```typescript
export interface AuditApiService {
  signIn(login: string, password: string): Promise<any>;
  signInWithMasterBootstrap(login: string, password: string): Promise<any>;
  signOut(): Promise<any>;
  getCurrentUser(): Promise<any>;
  getMasters(): Promise<{ origens: any[]; familias: any[]; agrupamentos: any[]; dicionario: any[] }>;
  upsertHistoricoCustos(payload: any[]): Promise<{ data: any; error: any }>;
  getHistorico(filters: { start: string; end: string; origem: string; familia: string; agrupamento: string }): Promise<{ data: any[] | null; error: any }>;
  getTrendsByProduct(codigoProduto: string): Promise<{ data: any[]; error: any }>;
}
```
