# ElectricTask — Instalação em VPS (Ubuntu/Debian)

Este guia explica como instalar o ElectricTask em uma **VPS** (servidor
próprio) usando o **mesmo pacote** `electrictask-installer.zip` da hospedagem
compartilhada — nenhuma alteração no projeto é necessária. O mesmo zip serve
para os dois cenários.

Os exemplos usam **Ubuntu 22.04/24.04** (valem também para Debian). Em outras
distribuições, adapte os comandos de instalação de pacotes.

## Requisitos

- VPS com acesso **root** (ou usuário com `sudo`)
- **Node.js 20 ou superior**
- Banco de dados **MySQL/MariaDB** ou **PostgreSQL** (pode ser instalado na
  própria VPS ou um banco gerenciado externo)
- **Nginx** (proxy reverso) e um domínio apontando para o IP da VPS
- Aproximadamente 300 MB de espaço livre (aplicação + dependências)

## 1. Instalar o Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # deve mostrar v20 ou superior
```

## 2. Instalar e preparar o banco de dados

Escolha **um** dos dois bancos abaixo (o assistente de instalação suporta os
dois).

### Opção A — MySQL/MariaDB

```bash
sudo apt-get install -y mariadb-server
sudo mysql
```

No prompt do MySQL:

```sql
CREATE DATABASE electrictask CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'electrictask'@'localhost' IDENTIFIED BY 'SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON electrictask.* TO 'electrictask'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Opção B — PostgreSQL

```bash
sudo apt-get install -y postgresql
sudo -u postgres psql
```

No prompt do PostgreSQL:

```sql
CREATE USER electrictask WITH PASSWORD 'SENHA_FORTE_AQUI';
CREATE DATABASE electrictask OWNER electrictask;
EXIT;
```

Anote: **tipo de banco**, **nome** (`electrictask`), **usuário**, **senha** e
**host** (`localhost`, ou o endereço do banco gerenciado).

## 3. Enviar e extrair o pacote

Primeiro, crie um usuário de sistema dedicado e instale as ferramentas:

```bash
sudo adduser --system --group --home /opt/electrictask electrictask
sudo apt-get install -y unzip git
```

Depois, envie os arquivos para a VPS usando **uma** das duas formas abaixo.

### Opção A — Envio direto do zip (scp/sftp)

1. No painel do ElectricTask (área de administração), baixe o
   `electrictask-installer.zip`.
2. Envie o zip para a VPS (ex.: `scp electrictask-installer.zip root@SEU_IP:/tmp/`)
   e extraia:

```bash
sudo unzip /tmp/electrictask-installer.zip -d /opt/electrictask
sudo chown -R electrictask:electrictask /opt/electrictask
ls /opt/electrictask   # server.js deve estar na raiz
```

### Opção B — Envio via GitHub (recomendado para atualizações fáceis)

A ideia é manter o **conteúdo do pacote** em um repositório **privado** no
GitHub. Assim, instalar e atualizar a VPS vira um simples `git clone` /
`git pull`.

**No seu computador** (uma única vez):

1. Baixe o `electrictask-installer.zip` no painel do ElectricTask e extraia.
2. Crie um repositório **privado** no GitHub (ex.: `electrictask-release`).
3. Envie o conteúdo extraído para o repositório:

```bash
cd pasta-extraida-do-zip
git init -b main
git add .
git commit -m "ElectricTask release"
git remote add origin https://github.com/SEU_USUARIO/electrictask-release.git
git push -u origin main
```

> Importante: use um repositório **privado** e nunca faça commit dos
> arquivos `.env`, `.installed` e da pasta `uploads/` — eles são criados na
> VPS e devem ficar só lá. Se quiser, crie um `.gitignore` com essas
> entradas.

**Na VPS:**

1. Gere um token de acesso no GitHub (Settings → Developer settings →
   **Personal access tokens**, permissão de leitura do repositório) ou
   configure uma chave SSH de deploy.
2. Clone o repositório na pasta da aplicação:

```bash
sudo git clone https://SEU_TOKEN@github.com/SEU_USUARIO/electrictask-release.git /opt/electrictask
sudo chown -R electrictask:electrictask /opt/electrictask
ls /opt/electrictask   # server.js deve estar na raiz
```

### Instalar as dependências (para as duas opções)

```bash
cd /opt/electrictask
sudo -u electrictask npm install --omit=dev
```

## 4. Criar o serviço (systemd)

Na VPS não existe o Passenger do cPanel, então usamos o **systemd** para
manter a aplicação rodando e reiniciá-la sozinha. O mesmo `server.js` do
pacote é o ponto de entrada — basta definir a porta pela variável `PORT`.

Crie o arquivo `/etc/systemd/system/electrictask.service`:

```ini
[Unit]
Description=ElectricTask
After=network.target mariadb.service postgresql.service

[Service]
Type=simple
User=electrictask
Group=electrictask
WorkingDirectory=/opt/electrictask
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /opt/electrictask/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ative e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now electrictask
sudo systemctl status electrictask   # deve estar "active (running)"
```

> Observação: o `server.js` lê o arquivo `.env` da pasta da aplicação
> automaticamente. Enquanto a instalação não for concluída, ele sobe o
> assistente de instalação; depois, sobe a aplicação principal. É o mesmo
> comportamento da hospedagem compartilhada.

## 5. Configurar o Nginx (proxy reverso)

```bash
sudo apt-get install -y nginx
```

Crie `/etc/nginx/sites-available/electrictask`:

```nginx
server {
    listen 80;
    server_name SEU-DOMINIO.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Ative e recarregue:

```bash
sudo ln -s /etc/nginx/sites-available/electrictask /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### HTTPS (recomendado)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU-DOMINIO.com
```

O Certbot configura o certificado e a renovação automática.

## 6. Executar o assistente de instalação

1. Acesse `https://SEU-DOMINIO.com/install` no navegador.
2. Siga as 5 etapas do assistente (as mesmas do guia de hospedagem
   compartilhada):
   1. **Verificação do ambiente**
   2. **Banco de dados** — informe o tipo, host (`localhost`), porta
      (`3306` MySQL / `5432` PostgreSQL), nome, usuário e senha do passo 2 e
      clique em **Testar conexão**.
   3. **Criação das tabelas** — automática (`schema.mysql.sql` ou
      `schema.pgsql.sql`).
   4. **Usuário administrador** — nome, e-mail e senha.
   5. **Finalizar** — o `.env` é gravado com as chaves de segurança e o
      assistente é bloqueado.
3. Reinicie o serviço para garantir que a aplicação principal suba:

```bash
sudo systemctl restart electrictask
```

4. Acesse `https://SEU-DOMINIO.com/` e entre com o e-mail e a senha do
   administrador.

## 7. Depois da instalação

- O assistente fica **bloqueado** (arquivo `.installed` em
  `/opt/electrictask`). Acessar `/install` redireciona para o login.
- **Backups**: inclua o arquivo `.env`, a pasta `uploads/` (anexos e
  avatares) e um dump do banco:
  - MySQL: `mysqldump -u electrictask -p electrictask > backup.sql`
  - PostgreSQL: `sudo -u postgres pg_dump electrictask > backup.sql`
- **Logs da aplicação**: `sudo journalctl -u electrictask -f`
- Para **reinstalar do zero**: apague `.installed` e `.env` da pasta e
  reinicie o serviço (`sudo systemctl restart electrictask`).

## Atualização de versão (instalação existente)

> **Atenção:** nunca apague a pasta `/opt/electrictask`. Os arquivos ocultos
> `.env` e `.installed` guardam a conexão com o banco e a trava do
> assistente. Se forem perdidos, a aplicação volta ao modo de instalação.

1. Faça backup do `.env`, da pasta `uploads/` e do banco.
2. Atualize os arquivos usando a mesma forma escolhida na instalação:

**Se usou a Opção A (zip):** envie o novo `electrictask-installer.zip` e
extraia **por cima** da pasta, sobrescrevendo os arquivos:

```bash
sudo unzip -o /tmp/electrictask-installer.zip -d /opt/electrictask
sudo chown -R electrictask:electrictask /opt/electrictask
cd /opt/electrictask && sudo -u electrictask npm install --omit=dev
sudo systemctl restart electrictask
```

**Se usou a Opção B (GitHub):** no seu computador, extraia o novo zip por
cima da pasta do repositório, faça commit e push:

```bash
cd pasta-do-repositorio
git add .
git commit -m "Atualização ElectricTask"
git push
```

E na VPS basta puxar as mudanças e reiniciar:

```bash
cd /opt/electrictask
sudo -u electrictask git pull
sudo -u electrictask npm install --omit=dev
sudo systemctl restart electrictask
```

3. Ao iniciar, a aplicação **atualiza o banco automaticamente** (cria apenas
   tabelas/colunas/índices que faltam — nunca apaga dados). O registro fica
   em `upgrade-db.log` na pasta da aplicação.
4. **Não acesse `/install`** — o assistente é só para a primeira instalação.

## Solução de problemas

| Problema | Causa provável / solução |
| --- | --- |
| 502 Bad Gateway no Nginx | A aplicação não está rodando. Veja `sudo systemctl status electrictask` e `sudo journalctl -u electrictask -n 50`. |
| Serviço reiniciando em loop | Verifique os logs (`journalctl`). Causas comuns: `npm install` não executado ou `DATABASE_URL` inválida no `.env`. |
| Falha na conexão com o banco | Confira host/porta/usuário/senha. Teste com `mysql -u electrictask -p` ou `psql -U electrictask -h localhost electrictask`. |
| "Módulo X FALHOU" na etapa 1 | Rode `npm install --omit=dev` novamente na pasta da aplicação. |
| Erro de permissão | `sudo chown -R electrictask:electrictask /opt/electrictask` |
| Porta 3000 em uso | Troque `Environment=PORT=3000` no serviço e o `proxy_pass` do Nginx para outra porta, depois `daemon-reload` + restart. |
| Upload falha com arquivo grande | Aumente `client_max_body_size` no Nginx. |

## Observações

- **Uploads**: os arquivos enviados ficam em `/opt/electrictask/uploads/`
  (criada automaticamente). Inclua nos backups.
- O `.env` é criado com permissão restrita (600). Não compartilhe o conteúdo.
- O mesmo pacote funciona em hospedagem compartilhada — veja o
  `install-setup.md` para o passo a passo com cPanel.
