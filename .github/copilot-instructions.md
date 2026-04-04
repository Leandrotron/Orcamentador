# Copilot Instructions — Orçamentador Pousada Viva Mar

## Project Overview

**Orçamentador** is an internal pricing and quote generation tool for Pousada Viva Mar, a Brazilian coastal inn.

The system is built around a **JSON-based pricing engine**, where all rates, restrictions, and rules are pre-processed and stored in `dados.json`.

The application is a lightweight HTML/JavaScript interface (optionally wrapped in Electron) that generates quotes and formats them for WhatsApp communication.

There is no backend. All computation happens locally in the browser or Electron environment.

---

## Core Architecture

- `dados.json` is the **single source of truth**
- All pricing rules are **date-based and precomputed**
- The frontend only reads and applies rules
- CSV is NOT used at runtime (only in converter stage)
- GitHub is used as a **distribution layer for pricing data**

---

## System Components

### 1. App (Frontend)
- Located in: `/app` (or root if not yet separated)
- Files: `index.html`, `main.js`, `assets/`
- Responsible for:
  - User input (dates, rooms, guests)
  - Quote calculation
  - UI rendering
  - WhatsApp message generation

---

### 2. Pricing Data (`dados.json`)

```json
{
  "version": "YYYY-MM-DD-N",
  "updatedAt": "YYYY-MM-DD",
  "messageTemplate": "...",
  "daily": {
    "2026-03-02": {
      "base": 320,
      "extra": 90,
      "minStay": 0,
      "cta": 0,
      "ctd": 0
    }
  }
}