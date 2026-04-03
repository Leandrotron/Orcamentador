# Copilot Instructions — Orçamentador Pousada Viva Mar

## Project Overview
**Orçamentador** is an internal booking quote generator for Pousada Viva Mar, a Brazilian coastal inn. It's a lightweight Electron desktop app + vanilla HTML/JS that generates accommodation quotes with dynamic pricing and sends them via WhatsApp. 

**Architecture**: Single-page HTML app (`index.html`) embedded in Electron shell (`main.js`), with pricing data stored in JSON (`dados.json`). No backend—all computation in browser, data sync from GitHub.

---

## Core Data Structure & Workflows

### Pricing Database (`dados.json`)
```json
{
  "version": "YYYY-MM-DD-N",          // Cloudbeds export version
  "updatedAt": "YYYY-MM-DD",
  "messageTemplate": "...",           // WhatsApp message template
  "daily": {
    "2026-03-02": {
      "base": 320,                    // Per-night base price (2 guests)
      "extra": 90,                    // Per-night price per extra guest
      "minStay": 0,                   // Min nights required
      "cta": 0,                       // Arrival restrictions (CTA=Chegada)
      "ctd": 0                        // Departure restrictions (CTD=Checkin To Depart)
    }
  }
}
```
**Key pattern**: Every pricing rule is **date-specific**. Weekends, holidays, and peak seasons have separate entries. No rate codes—just flat daily rates.

### Two Data Sources
1. **Remote (GitHub)**: `https://raw.githubusercontent.com/Leandrotron/Orcamentador/main/dados.json`
   - Manual sync triggered by user in Settings → Sync tab
   - Function: `syncRemoteData(showFeedback=true)` (line ~414)
2. **Local (browser storage)**: Falls back if GitHub unavailable or user imports CSV

---

## Critical Features & Implementation Patterns

### Quote Calculation (`calc()`)
- **Inputs**: Check-in, check-out dates, room type(s), guest count, extras (baby reduction)
- **Logic**: 
  1. Lookup daily prices for each night (date-by-date)
  2. Apply minimum stay restrictions
  3. Calculate base cost (per room) + extra guests
  4. Detect CTA/CTD restrictions (arrival/departure day constraints)
  5. Sum total, apply no markup—prices are final
- **Output**: Breakdown table + WhatsApp-formatted message

### Room Management
- Rooms added dynamically with "+ Adicionar quarto" button
- Each room has: type selector, guest count, baby count
- DOM structure: `.room` divs under "Quartos" section
- Function: `addRoom()`, `delRoom()` (event-driven)

### CSV Import (Cloudbeds)
- Tab: "Importar do Cloudbeds (CSV)"
- Parser: Converts Cloudbeds CSV export → `dados.json` format
- Function: `csvParse()` (line ~871) → `btnImport.addEventListener()` (line ~899)
- **Expected CSV columns**: Date, Base Price, Extra Guest, Min Stay, CTA, CTD
- **Output**: Replaces local `DAILY` object, saves to localStorage

### Sync & Settings
- **Settings modal** (dialog element): Tabs for CSV import + sync status
- **Data persistence**: `localStorage` keys—`vm_data_meta_v1`, `vm_msg_tpl_key`
- **Auto-sync on load**: `document.addEventListener('DOMContentLoaded', ...)` calls `syncRemoteData(false)` (silent)

---

## Developer Patterns & Conventions

### State Management
- **Global state in localStorage**:
  - `vm_msg_tpl_key`: WhatsApp message template (user editable)
  - `vm_data_meta_v1`: Sync metadata (version, source, timestamp)
- **In-memory pricing**: `DAILY = {}` (global, loaded on init)
- **No framework**: Direct DOM manipulation via `document.getElementById()`, `addEventListener()`

### Date Handling
- Format: ISO `YYYY-MM-DD` (strings, not Date objects)
- All lookups: `DAILY[dateString]` (direct key access)
- Checkout calendar auto-updates minimum date based on check-in + min stay

### Error Handling
- **Sync errors**: Graceful fallback to local data + user alert
  - e.g., if GitHub unavailable, use cached local copy
- **Validation**: Check fields before calculation, show muted hints
- **UI feedback**: Alerts for sync success/failure; buttons disable during async ops

### UI & Styling
- **CSS variables** for Viva Mar branding: `--vm-green`, `--vm-orange`, `--vm-ink`
- **Responsive grid**: Main section 1.2fr | sidebar 1fr on desktop; single column on mobile
- **Semantic HTML**: Cards (`.card`), sections, form inputs with labels

---

## Build & Deployment

### Dependencies
- **Runtime**: Electron v30.0.0
- **Build**: Electron-builder v24.13.0
- **Scripts**:
  - `npm start` / `npm run dev`: Launch Electron dev window
  - `npm run build`: Create NSIS installer for Windows (output to `dist/`)

### Electron Entry Point (`main.js`)
- Creates BrowserWindow (1200×800), loads `index.html`
- Config: No menu (commented out), node integration enabled (security: low, but internal-only app)
- Output file: Named "Orçamentador — Pousada Viva Mar"

### Distribution
- Windows NSIS installer: One-click, per-user install (no admin needed)
- Icon: `assets/logo.ico`
- Asar packaging enabled (app bundled as single archive)

---

## Critical Functions Reference

| Function | Purpose | Location |
|----------|---------|----------|
| `calc()` | Main quote calculation & output | DOM event listener (~line 440) |
| `syncRemoteData(bool)` | Fetch & apply GitHub pricing | Line ~414 |
| `applyRemotePayload(data, source)` | Parse remote JSON, merge with local state | Line ~360 |
| `csvParse()` | Parse pasted Cloudbeds CSV | Line ~871 |
| `addRoom()` | Dynamically create room input row | DOM-driven |
| `renderDataStatus()` | Update sync metadata display | Line ~380 |
| `loadDaily()` / `saveDaily(obj)` | localStorage getters/setters for daily prices | Implicit in code |

---

## Testing & Validation

- **Test runner**: "Executar testes" button in summary panel (details element, line ~148)
- **Tests include**: Date range validation, min stay enforcement, CTA/CTD rules
- **Example rooms**: Pre-populated test data to verify calculation logic

---

## Common Modification Patterns

- **Change branding colors**: Edit CSS variables in `<style>` (lines 9–14)
- **Update remote data source**: Change `REMOTE_DATA_URL` (line 330)
- **Adjust WhatsApp template**: Edit `DEFAULT_MSG_TEMPLATE` (line ~320) or user Settings tab
- **Add new pricing field** (e.g., discount): Extend `daily[date]` object + update CSV parser + recalc logic

---

## Known Limitations & Design Decisions

1. **No authentication**: Internal tool; assumes trusted users only (Electron desktop app)
2. **No database**: All data in JSON; sync is manual pull from GitHub, not real-time
3. **Date strings only**: No timezone handling; assumes local Brazil timezone
4. **Single room type selector**: Rates don't vary by room type; variant pricing managed via separate check-ins
5. **CSV import overwrites**: No merge/conflict resolution; full data replacement on import

---

## References
- **README**: Root README describes Cloudbeds workflow, tariff update process
- **Electron docs**: https://www.electronjs.org/docs
- **GitHub raw.githubusercontent.com URL**: Data synced from public repo
