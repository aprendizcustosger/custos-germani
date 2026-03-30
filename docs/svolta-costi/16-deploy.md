# Capítulo 16 — Deploy

## 16.1 Modelo de publicação
O deploy atual é estático (frontend), com Supabase como backend gerenciado.

| Propriedade | Valor | Propósito |
|-------------|-------|-----------|
| Artefato | HTML/CSS/JS estático | Publicação simplificada |
| Backend | Supabase | API e banco remotos |
| Proxy/NGINX | Opcional | Cache e TLS |

## 16.2 Procedimento recomendado

```text
1) Validar arquivos estáticos e variáveis de ambiente públicas.
2) Publicar diretório do site no host/CDN.
3) Verificar conectividade com Supabase.
4) Executar teste manual: upload + relatório + tendência.
```
