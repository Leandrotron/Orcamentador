# 🧾 Orçamentador — Pousada Viva Mar

Ferramenta interna para geração de orçamentos de hospedagem, com base em tarifário dinâmico integrado ao Cloudbeds.

---

## 🎯 Objetivo

Facilitar e padronizar o envio de orçamentos via WhatsApp, reduzindo erros operacionais e garantindo consistência nos valores.

---

## ⚙️ Como funciona

O sistema é dividido em duas partes:

### 1. Interface (index.html)
- Aplicação leve em HTML + JavaScript
- Roda diretamente no navegador (sem instalação)
- Utilizada pelos recepcionistas para gerar orçamentos

### 2. Base de dados (dados.json)
- Hospedada no GitHub
- Contém todo o tarifário atualizado
- Sincronizada manualmente pelo sistema

---

## 🔄 Fluxo de atualização de tarifário

1. Exportar tarifário do Cloudbeds (CSV)
2. Converter utilizando o Conversor de Tarifário
3. Gerar o arquivo `dados.json`
4. Atualizar o arquivo no GitHub
5. No Orçamentador:  
   → Configurações → Sincronização → Atualizar dados

---

## 📊 Estrutura do JSON

```json
{
  "version": "YYYY-MM-DD-N",
  "updatedAt": "YYYY-MM-DD",
  "messageTemplate": "...",
  "daily": {
    "YYYY-MM-DD": {
      "base": number,
      "extra": number,
      "minStay": number,
      "cta": 0,
      "ctd": 0
    }
  }
}
