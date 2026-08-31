# Copilot Instructions — Orçamentador Pousada Viva Mar

## 🧠 Project Overview

**Orçamentador** is an internal web-based booking quote generator used by Pousada Viva Mar.

It is a **single-page application (SPA)** built with:
- Vanilla HTML
- Vanilla JavaScript
- LocalStorage
- GitHub as data source

There is **NO backend**.

---

## 🏗️ Architecture

### 1. Frontend (index.html)
- Runs entirely in the browser
- Responsible for:
  - UI
  - Business logic
  - Price calculation
  - Message generation
  - Local persistence

### 2. Data Source (dados.json)
- Hosted on GitHub
- Acts as the **single source of truth**
- Contains:
  - pricing (`daily`)
  - metadata (`version`, `updatedAt`)
  - optional `messageTemplate`
  - optional shared package-break configuration (`packageBreaks`)
  - optional exact stay-price equivalences (`stayEquivalences`)
  - optional independent explicit check-in blocks (`checkinBlocks`)

---

## 🔄 Data Flow

### Tarifário update flow:

Cloudbeds → CSV export → Conversor → JSON → GitHub → Orçamentador sync

### Runtime flow:

1. App loads
2. Loads local cache (localStorage)
3. User can trigger sync (GitHub)
4. Remote data updates pricing (`daily`) and, when present, shared package-break, stay-equivalence, and independent check-in-block configurations (`packageBreaks`, `stayEquivalences`, `checkinBlocks`)
5. Local data persists:
   - message template
   - package-break configuration
   - stay-equivalence configuration
   - independent explicit check-in-block configuration
   - UI state

---

## 📊 Data Model (CRITICAL)

### REQUIRED FORMAT

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
