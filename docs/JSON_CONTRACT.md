# JSON Contract — Orçamentador Viva Mar

Este arquivo define o formato oficial do `dados.json` utilizado entre o Conversor e o Orçamentador.

## Estrutura oficial

```json
{
  "version": "2026-04-27-01",
  "updatedAt": "2026-04-27",
  "messageTemplate": "string opcional",
  "packageBreaks": [
    {
      "id": "identificador-estavel",
      "name": "Pacote de exemplo",
      "from": "2026-09-04",
      "to": "2026-09-07",
      "allowBreak": false,
      "minNights": 1,
      "surchargeType": "percent",
      "surchargeValue": 0
    }
  ],
  "stayEquivalences": [
    {
      "id": "identificador-estavel",
      "name": "Alternativa autorizada",
      "active": false,
      "referenceFrom": "2026-09-04",
      "referenceTo": "2026-09-07",
      "alternativeFrom": "2026-09-03",
      "alternativeTo": "2026-09-06"
    }
  ],
  "checkinBlocks": [
    {
      "id": "bloqueio-estavel",
      "name": "Bloqueios do período especial",
      "active": true,
      "dates": ["2026-09-05"]
    }
  ],
  "daily": {
    "2026-04-27": {
      "base": 300,
      "extra": 90,
      "minStay": 1,
      "cta": 0,
      "ctd": 0
    }
  }
}
```

## Campos

- `version`
  String. Formato recomendado: `YYYY-MM-DD-N`.

- `updatedAt`
  String. Formato: `YYYY-MM-DD`.

- `messageTemplate`
  String opcional.

- `packageBreaks`
  Array opcional e retrocompatível de configurações de pacote e quebra. Quando ausente, o Orçamentador preserva a configuração local existente; um array vazio representa a remoção explícita dos pacotes compartilhados.

- `stayEquivalences`
  Array opcional e retrocompatível de equivalências exatas de estadia. Quando ausente, o Orçamentador preserva a configuração local existente; um array vazio representa a remoção explícita das equivalências compartilhadas.

- `checkinBlocks`
  Array opcional e retrocompatível de bloqueios explícitos de chegada, independente de `stayEquivalences`. Quando ausente, preserva os bloqueios locais; um array vazio representa a remoção explícita dos bloqueios compartilhados.

- `daily`
  Objeto onde cada chave é uma data no formato `YYYY-MM-DD`.

## Campos por pacote em `packageBreaks`

- `id`
  String não vazia e única.

- `name`
  Nome exibido na conferência interna.

- `from` e `to`
  Datas `YYYY-MM-DD`. `from` é a primeira noite; `to` é a data de saída e não integra as noites do pacote.

- `allowBreak`
  Boolean. A quebra fica desligada quando `false`.

- `minNights`
  Inteiro `>= 1` e menor que a duração total do pacote. Somente noites dentro do intervalo contam para esse mínimo.

- `surchargeType`
  `percent` para percentual sobre a tarifa base de cada noite afetada, ou `fixed` para valor em reais acrescentado por diária afetada.

- `surchargeValue`
  Number `>= 0`. Não redefine a tarifa diária nem o preço do pacote completo.

## Campos por equivalência em `stayEquivalences`

- `id` e `name`
  Textos não vazios. O `id` deve ser único.

- `active`
  Boolean. Somente equivalências ativas são usadas para substituir o preço da estadia; não controla bloqueios de check-in.

- `referenceFrom` e `referenceTo`
  Entrada e saída do período cujo preço será calculado diretamente pelo mecanismo original.

- `alternativeFrom` e `alternativeTo`
  Entrada e saída reais que devem corresponder exatamente à reserva. Referência e alternativa precisam ter a mesma quantidade de noites.

## Campos por bloqueio em `checkinBlocks`

- `id` e `name`
  Textos não vazios. O `id` deve ser único.

- `active`
  Boolean próprio do bloqueio, sem relação com a ativação de equivalências.

- `dates`
  Array não vazio de datas `YYYY-MM-DD`. Bloqueia somente a entrada nessas datas; não bloqueia a permanência de uma reserva iniciada antes. Uma mesma data não pode aparecer em dois bloqueios.

## Campos por data

- `base`
  Número `>= 0`. Valor da diária para 2 pessoas.

- `extra`
  Número `>= 0`. Valor por pessoa extra por noite.

- `minStay`
  Inteiro `>= 0`.

- `cta`
  `0` ou `1`. Flag de fechado para chegada.

- `ctd`
  `0` ou `1`. Flag de fechado para saída.

## Regras importantes

- Todas as datas devem estar em formato `YYYY-MM-DD`.
- O JSON deve cobrir todas as datas do período sem buracos, idealmente.
- Valores `0` são válidos, mas podem ativar fallback no Orçamentador.
- `cta` e `ctd` devem ser tratados como flags booleanas em formato `0/1`.
- O Orçamentador aceita boolean, mas o padrão oficial é `0/1`.
- Pacotes não podem compartilhar noites. Intervalos adjacentes, em que a saída de um é a entrada do seguinte, são permitidos.
- `packageBreaks` não altera os registros de `daily`; é uma configuração complementar aplicada somente a quebras elegíveis.
- `stayEquivalences` não altera `daily`, não admite alternativa duplicada, autorreferência ou encadeamento e não recebe acréscimo de quebra ao calcular a referência.
- Várias alternativas podem apontar para a mesma referência.
- `checkinBlocks` é independente da existência, ativação ou exclusão de equivalências.
- Bloqueios explícitos de check-in são rígidos e não participam da liberação manual de CTA/CTD/minStay.
- O campo legado `blockedCheckins` dentro de uma equivalência ainda é aceito na leitura; suas datas são migradas uma vez para `checkinBlocks` ativos e independentes.

## Comportamento do sistema

- Se o JSON for inválido, não aplica.
- Se houver warnings, aplica com aviso.
- Se faltarem dados, fallback pode ser usado.
- JSONs antigos sem `packageBreaks`, `stayEquivalences` ou `checkinBlocks` continuam válidos e não apagam as configurações locais correspondentes.

## Fonte de verdade

- O Conversor é responsável por gerar esse JSON.
- O Orçamentador apenas consome.
