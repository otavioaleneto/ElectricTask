# ElectricTask — Instalação em Hospedagem Compartilhada (cPanel)

Este guia explica como instalar o ElectricTask em uma hospedagem compartilhada que
ofereça o recurso **"Setup Node.js App"** (cPanel com Phusion Passenger) e um
banco de dados **MySQL/MariaDB** ou **PostgreSQL**.

## Requisitos

- cPanel com **Setup Node.js App** (CloudLinux / Passenger)
- **Node.js 20 ou superior** disponível no seletor
- Banco de dados **MySQL 5.7+ / MariaDB 10.x** (menu "MySQL Databases") **ou**
  **PostgreSQL** (menu "PostgreSQL Databases")
- Aproximadamente 300 MB de espaço livre (aplicação + dependências)

> O MySQL/MariaDB é o banco mais comum em hospedagem compartilhada e é
> totalmente suportado. Se a sua hospedagem também oferecer PostgreSQL, os
> dois funcionam — escolha um deles no assistente de instalação.

## 1. Baixar o pacote de instalação

No painel do ElectricTask (área de administração), clique em
**"Baixar instalador"**. Você receberá o arquivo `electrictask-installer.zip`
contendo apenas os arquivos necessários (sem `node_modules` e sem o
código-fonte do projeto).

Conteúdo do pacote:

| Arquivo/Pasta | Descrição |
| --- | --- |
| `server.js` | Arquivo de inicialização (startup file) para o cPanel |
| `dist/` | Servidor da aplicação (bundle) |
| `public/` | Site (front-end compilado) |
| `installer/` | Assistente de instalação |
| `schema.mysql.sql` | Estrutura do banco de dados (MySQL/MariaDB) |
| `schema.pgsql.sql` | Estrutura do banco de dados (PostgreSQL) |
| `package.json` | Dependências mínimas de produção |
| `install-setup.md` | Este guia |

## 2. Criar o banco de dados

1. No cPanel, abra **MySQL Databases** (ou **PostgreSQL Databases**, se
   preferir usar PostgreSQL).
2. Crie um banco, por exemplo `usuario_electrictask`.
3. Crie um usuário, por exemplo `usuario_fd`, com uma senha forte.
4. Adicione o usuário ao banco (botão "Add User To Database") com todos os
   privilégios.
5. Anote: **tipo de banco** (MySQL ou PostgreSQL), **nome do banco**,
   **usuário**, **senha** e o **host** (normalmente `localhost`).

## 3. Enviar os arquivos

1. No cPanel, abra o **Gerenciador de Arquivos** (File Manager).
2. Crie uma pasta para a aplicação **fora** de `public_html`, por exemplo:
   `/home/SEU_USUARIO/electrictask`.
3. Envie o `electrictask-installer.zip` para essa pasta e use **Extract** para
   descompactar. Confirme que `server.js` ficou na raiz da pasta
   (ex.: `/home/SEU_USUARIO/electrictask/server.js`).

## 4. Configurar o "Setup Node.js App"

1. No cPanel, abra **Setup Node.js App** e clique em **Create Application**.
2. Preencha:
   - **Node.js version**: 20 ou superior (a mais recente disponível)
   - **Application mode**: `Production`
   - **Application root**: `electrictask` (a pasta criada no passo 3)
   - **Application URL**: o domínio ou subdomínio onde o ElectricTask vai rodar
   - **Application startup file**: `server.js`
3. Clique em **Create**.
4. Com a aplicação criada, clique em **Run NPM Install** para instalar as
   dependências (aguarde terminar — pode levar alguns minutos).
5. Clique em **Restart** para iniciar a aplicação.

> Se o seu painel não tiver o botão "Run NPM Install", use o terminal:
> entre no ambiente virtual indicado na tela (comando `source ...`) e rode
> `npm install` dentro da pasta da aplicação.

## 5. Executar o assistente de instalação

1. Acesse `https://SEU-DOMINIO/install` no navegador.
2. O assistente vai guiar você por 5 etapas:
   1. **Verificação do ambiente** — versão do Node.js, dependências
      instaladas e permissões de escrita.
   2. **Banco de dados** — escolha o tipo (MySQL/MariaDB ou PostgreSQL),
      informe host, porta, nome do banco, usuário e senha criados no passo 2
      e clique em **Testar conexão**.
   3. **Criação das tabelas** — o instalador executa automaticamente o
      arquivo de estrutura correspondente ao tipo escolhido
      (`schema.mysql.sql` ou `schema.pgsql.sql`).
   4. **Usuário administrador** — defina nome, e-mail e senha do
      administrador do sistema.
   5. **Finalizar** — o instalador grava o arquivo `.env` com as chaves de
      segurança (`SESSION_SECRET` e `SUBSCRIPTION_ENCRYPTION_KEY`) geradas
      automaticamente e bloqueia o assistente.
3. Ao concluir, a aplicação reinicia sozinha. Se necessário, clique em
   **Restart** no "Setup Node.js App".
4. Acesse `https://SEU-DOMINIO/` e entre com o e-mail e a senha do
   administrador criados na etapa 4.

## 6. Depois da instalação

- O assistente fica **bloqueado** (arquivo `.installed`). Acessar `/install`
  passa a redirecionar para a tela de login.
- Para **reinstalar do zero**: apague os arquivos `.installed` e `.env` da
  pasta da aplicação e reinicie a aplicação no cPanel. Atenção: será preciso
  refazer toda a configuração.
- Guarde uma cópia do arquivo `.env` em local seguro — ele contém a conexão
  com o banco e as chaves de segurança.

## Atualização de versão (instalação existente)

> **Atenção:** ao atualizar, **nunca apague a pasta da aplicação**. Os
> arquivos ocultos `.env` e `.installed` ficam nela — são eles que guardam a
> conexão com o banco de dados e a trava do assistente. Se eles forem
> perdidos, a aplicação volta ao modo de instalação e o assistente pode ser
> executado de novo apontando para um banco vazio, dando a impressão de que
> os dados sumiram (eles continuam no banco antigo).

Passo a passo seguro para atualizar:

1. Faça backup do arquivo `.env` e da pasta `uploads/` (e, por segurança, um
   export do banco no phpMyAdmin).
2. Envie o novo `electrictask-installer.zip` para a **mesma pasta** da aplicação.
3. Use **Extract** com a opção de **sobrescrever** os arquivos existentes.
   Não remova nada antes — apenas sobrescreva. Isso atualiza `dist/`,
   `public/`, `installer/`, `server.js` e os arquivos `schema.*.sql`, sem
   tocar em `.env`, `.installed` e `uploads/`.
4. Clique em **Restart** no "Setup Node.js App".
5. Ao iniciar, a aplicação **atualiza o banco de dados automaticamente**:
   cria apenas as tabelas, colunas e índices que estiverem faltando na nova
   versão — **nunca apaga nem altera dados existentes**. O que foi feito fica
   registrado no arquivo `upgrade-db.log` na pasta da aplicação.
6. Pronto. **Não acesse `/install`** — o assistente é só para a primeira
   instalação. Seus dados permanecem no banco.

Se depois de uma atualização os dados "sumirem": verifique o `.env` (o
Gerenciador de Arquivos precisa estar com "mostrar arquivos ocultos" ativo) e
compare a `DATABASE_URL` com o banco antigo no phpMyAdmin. Basta restaurar a
`DATABASE_URL` antiga e reiniciar para os dados voltarem.

## Solução de problemas

| Problema | Causa provável / solução |
| --- | --- |
| Página em branco ou erro 503 | A aplicação não iniciou. Verifique o log em "Setup Node.js App" e confirme que o startup file é `server.js`. |
| "Módulo X FALHOU" na etapa 1 | O `npm install` não foi executado ou falhou. Rode **Run NPM Install** novamente. |
| Falha na conexão com o banco | Confira host (geralmente `localhost`), nome do banco, usuário e senha. Verifique se o usuário foi adicionado ao banco com todos os privilégios. |
| Node.js abaixo de 20 | Selecione uma versão mais recente no "Setup Node.js App" e reinicie. |
| Erro de permissão na etapa 1 | Ajuste a permissão da pasta da aplicação para 755 no Gerenciador de Arquivos. |
| Alterei arquivos e nada mudou | Clique em **Restart** no "Setup Node.js App" (o Passenger mantém o processo em cache). |

## Observações

- **Upload de arquivos (avatares/anexos)**: em hospedagem compartilhada os
  arquivos enviados são gravados na pasta `uploads/` dentro da pasta da
  aplicação (criada automaticamente no primeiro upload). Inclua essa pasta
  nos seus **backups** — ela contém os anexos e avatares dos usuários.
  (Quando a variável `PRIVATE_OBJECT_DIR` está definida — ambiente Replit —
  o armazenamento de objetos em nuvem é usado no lugar do disco local.)
- O arquivo `.env` é criado com permissão restrita (600). Não compartilhe o
  conteúdo dele.
