# Deploy: Oracle Cloud (VM free tier) + Cloudflare

Este runbook sobe a API Hyperwood numa VM modesta (E2.1.Micro, 1GB RAM) no free tier da Oracle, atrás de Caddy com HTTPS, no domínio `hyperwood.yonkolab.xyz`.

## Estratégia

A VM tem 1GB de RAM e 1/8 de OCPU — compilar TypeScript aí dentro é lento e arrisca OOM. Então:

- **Build acontece na sua máquina local** (`docker build`), gerando a imagem `hyperwood-api:latest`.
- A imagem é enviada pronta pra VM com `docker save | ssh | docker load` (a VM só precisa do Docker).
- A imagem final é slim: multi-stage, só dependências de produção, migrations rodam via `drizzle-orm` runtime (`scripts/db-migrate.mjs`).
- Na VM rodam 3 containers: `db` (Postgres 17, sem porta pública), `api` (só acessível pela rede interna do compose), `caddy` (80/443, TLS automático via Let's Encrypt).

> **Importante:** isso assume VM x86_64 (E2.1.Micro é AMD). Se um dia migrar pra A1 Flex (ARM), o build local precisa da plataforma certa: `docker build --platform linux/amd64 .` resolve.

## 1. Preparar a VM (uma vez)

SSH na VM como `opc` (Oracle Linux) ou `ubuntu` (Ubuntu).

### Swap (recomendado para 1GB de RAM)

```sh
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Docker

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # relogar depois
```

### Portas 80 e 443

A Oracle bloqueia portas em **dois lugares**:

1. **Security List / NSG** (console OCI): adicionar Ingress Rules para TCP 80 e 443, source `0.0.0.0/0`.
2. **Firewall do SO**:

Ubuntu:

```sh
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Oracle Linux:

```sh
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

> O Postgres **não** é exposto — acesso administrativo via `docker compose -f docker-compose.prod.yml exec db psql -U postgres hyperwood`.

## 2. DNS no Cloudflare (via CLI)

Crie o registro A apontando `hyperwood` para o IP público da VM. Comece **sem proxy** (grey cloud) para o Caddy conseguir emitir o certificado Let's Encrypt por HTTP-01:

```sh
CF_API_TOKEN="<token com Zone:DNS:Edit>"
ZONE_ID=$(curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=yonkolab.xyz" | jq -r '.result[0].id')

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"hyperwood","content":"<IP_DA_VM>","ttl":300,"proxied":false}'
```

Após o primeiro deploy (certificado emitido), ative o proxy laranja:

```sh
RECORD_ID=$(curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=hyperwood.yonkolab.xyz" | jq -r '.result[0].id')

curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"proxied":true}'
```

E no dashboard Cloudflare, configure SSL/TLS como **Full (strict)**.

## 3. Segredos de produção

O arquivo `.env.prod` (na raiz do repo, gitignored) é a fonte das variáveis de produção — ele é copiado pra VM como `.env` no deploy. Chaves geradas uma vez: `POSTGRES_PASSWORD`, `TOTP_ENCRYPTION_KEY`, `API_KEY_ENCRYPTION_KEY`, `INTERNAL_BOOTSTRAP_TOKEN`, `FUNDING_PROVIDER_WEBHOOK_SECRET`.

Pendências quando for pra valer:

- `MAILERSEND_*`: hoje usa o domínio de teste (`test-...mlsender.net`). Para emails reais, cadastrar domínio verificado no MailerSend e atualizar.
- `MAILERSEND_WEBHOOK_SIGNING_SECRET`: preencher ao configurar o webhook.

## 4. Deploy

Na sua máquina (na raiz do repo):

```sh
DEPLOY_HOST=opc@<IP_DA_VM> npm run deploy
```

O script (`scripts/deploy.sh`):

1. `docker build` da imagem `hyperwood-api:latest`
2. `docker save | gzip | ssh | docker load` (envia a imagem pronta)
3. Copia `docker-compose.prod.yml`, `Caddyfile` e `.env.prod` → `~hyperwood/.env` na VM
4. `docker compose up -d` na VM

Variáveis opcionais: `DEPLOY_DIR` (padrão `hyperwood`), `ENV_FILE` (padrão `.env.prod`).

### Pós-deploy

```sh
curl https://hyperwood.yonkolab.xyz/health
curl https://hyperwood.yonkolab.xyz/api/v1/...  # rotas da API
```

### Operação na VM

```sh
cd ~/hyperwood
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml exec db psql -U postgres hyperwood
```

## 5. Redeploys

Mesmo comando — imagens Docker são empilhadas por camada, então só as camadas alteradas são reenviadas. A cada deploy `docker image prune -f` remove camadas antigas na VM (boot volume de ~47GB aguenta folgado).

## Memória esperada (VM 1GB)

| Processo | ~RAM |
|---|---|
| Postgres (tuning do compose) | 150–250MB |
| API Node | 150–300MB |
| Caddy | 30MB |
| SO | 150MB |

Sobra margem; o swap cobre picos (ex.: vacuum do Postgres).
