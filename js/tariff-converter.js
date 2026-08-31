(function (global) {
  'use strict';

  // XLSX reading expects SheetJS xlsx@0.18.5 to be available as window.XLSX.

  function normalizeCell(value) {
    return String(value == null ? '' : value).trim();
  }

  function getXLSX() {
    if (!global.XLSX || typeof global.XLSX.read !== 'function' ||
        !global.XLSX.utils || typeof global.XLSX.utils.sheet_to_json !== 'function') {
      throw new Error('SheetJS não está disponível. Carregue xlsx@0.18.5 antes de ler um arquivo XLSX.');
    }
    return global.XLSX;
  }

  async function readFile(file) {
    if (!file || typeof file.name !== 'string') {
      throw new Error('Arquivo inválido ou não informado.');
    }

    var extension = (file.name.split('.').pop() || '').toLowerCase();
    if (extension === 'xlsx') return readXLSXAsGrid(file);
    if (extension === 'csv') return readCSVAsGrid(file);
    throw new Error('Formato não suportado. Use .xlsx ou .csv');
  }

  async function readXLSXAsGrid(file) {
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new Error('Arquivo XLSX inválido ou não informado.');
    }

    var XLSX = getXLSX();
    var buffer = await file.arrayBuffer();
    var workbook = XLSX.read(buffer, { type: 'array' });
    var sheetName = workbook.SheetNames[0];
    if (!sheetName || !workbook.Sheets[sheetName]) {
      throw new Error('O arquivo XLSX não contém uma planilha legível.');
    }
    var worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
  }

  async function readCSVAsGrid(file) {
    if (!file || typeof file.text !== 'function') {
      throw new Error('Arquivo CSV inválido ou não informado.');
    }

    var text = await file.text();
    var delimiter = detectDelimiter(text);
    return parseCSVToGrid(text, delimiter);
  }

  function detectDelimiter(text) {
    var head = String(text == null ? '' : text).slice(0, 8000);
    var commas = (head.match(/,/g) || []).length;
    var semicolons = (head.match(/;/g) || []).length;
    return semicolons > commas ? ';' : ',';
  }

  function parseCSVToGrid(text, delimiter) {
    text = String(text == null ? '' : text);
    delimiter = delimiter || detectDelimiter(text);

    if (delimiter !== ',' && delimiter !== ';') {
      throw new Error('Delimitador CSV inválido. Use vírgula ou ponto e vírgula.');
    }

    var rows = [];
    var row = [];
    var current = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var character = text[i];
      var next = text[i + 1];

      if (inQuotes) {
        if (character === '"' && next === '"') {
          current += '"';
          i++;
        } else if (character === '"') {
          inQuotes = false;
        } else {
          current += character;
        }
      } else if (character === '"') {
        inQuotes = true;
      } else if (character === delimiter) {
        row.push(current);
        current = '';
      } else if (character === '\n') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else if (character !== '\r') {
        current += character;
      }
    }

    row.push(current);
    rows.push(row);
    return rows.map(function (cells) {
      return cells.map(normalizeCell);
    });
  }

  function normalizeRoom(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\d+\s+acomodacoes?/g, '')
      .trim();
  }

  function parseMoney(value) {
    var text = String(value || '').trim();
    if (!text) return 0;
    text = text.replace(/[^\d,.-]/g, '');

    if (text.includes(',') && text.includes('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else if (text.includes(',')) {
      text = text.replace(',', '.');
    }

    var parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseIntSafe(value) {
    var parsed = parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseBool01(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text) return 0;
    return ['1', 'true', 'yes', 'y', 'sim', 's', 'fechado', 'closed'].includes(text) ? 1 : 0;
  }

  function formatBRNumber(value) {
    return Number(value).toFixed(2).replace('.', ',');
  }

  function buildCsv(daily) {
    if (!daily || typeof daily !== 'object' || Array.isArray(daily)) {
      throw new Error('Objeto daily inválido para geração do CSV.');
    }

    var dates = Object.keys(daily);
    var csv = '';
    csv += ';' + dates.join(';') + '\n';
    csv += 'Tarifário base;' + dates.map(function (date) { return formatBRNumber(daily[date].base || 0); }).join(';') + '\n';
    csv += 'Preço para o adulto 3;' + dates.map(function (date) { return String(daily[date].extra || 0); }).join(';') + '\n';
    csv += 'Estadia mínima;' + dates.map(function (date) { return String(daily[date].minStay || 0); }).join(';') + '\n';
    csv += 'Fechado para Chegada;' + dates.map(function (date) { return String(daily[date].cta || 0); }).join(';') + '\n';
    csv += 'Fechado para Partida;' + dates.map(function (date) { return String(daily[date].ctd || 0); }).join(';') + '\n';
    return csv;
  }

  function convertGrid(options) {
    options = options || {};
    var grid = options.grid;
    var roomHint = options.roomHint;
    var version = options.version == null ? '' : String(options.version).trim();
    var updatedAt = options.updatedAt == null ? '' : String(options.updatedAt).trim();
    var messageTemplate = options.messageTemplate == null ? '' : String(options.messageTemplate).trim();

    if (!Array.isArray(grid)) throw new Error('Grid inválido. Era esperada uma matriz de células.');
    if (!/^\d{4}-\d{2}-\d{2}-\d+$/.test(version)) {
      throw new Error('Version inválida. Use o formato YYYY-MM-DD-N, por exemplo 2026-04-03-01.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updatedAt)) {
      throw new Error('UpdatedAt inválido. Use o formato YYYY-MM-DD.');
    }
    if (!messageTemplate) throw new Error('MessageTemplate não pode ficar vazio.');

    var datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    var bestRowIndex = -1;
    var bestCount = 0;

    for (var rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      var candidateRow = grid[rowIndex] || [];
      var count = 0;
      for (var candidateCellIndex = 0; candidateCellIndex < candidateRow.length; candidateCellIndex++) {
        if (datePattern.test(normalizeCell(candidateRow[candidateCellIndex]))) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestRowIndex = rowIndex;
      }
    }

    if (bestRowIndex === -1 || bestCount < 7) {
      throw new Error('Não encontrei uma linha de datas DD/MM/AAAA forte o suficiente no arquivo.');
    }

    var dateRow = (grid[bestRowIndex] || []).map(normalizeCell);
    var dateIndices = [];
    var isoDates = [];

    for (var columnIndex = 0; columnIndex < dateRow.length; columnIndex++) {
      var dateCell = dateRow[columnIndex];
      if (datePattern.test(dateCell)) {
        dateIndices.push(columnIndex);
        var dateParts = dateCell.split('/');
        isoDates.push(dateParts[2] + '-' + dateParts[1] + '-' + dateParts[0]);
      }
    }

    var hint = normalizeRoom(roomHint);
    if (!hint) throw new Error('Nome do quarto vazio. Preencha o campo do quarto.');

    var roomMatches = [];
    for (var roomRowIndex = 0; roomRowIndex < grid.length; roomRowIndex++) {
      var joined = (grid[roomRowIndex] || []).map(normalizeCell).join(' ');
      var cleanLine = normalizeRoom(joined);
      var isTargetMatch = cleanLine.includes(hint) &&
        !cleanLine.includes('sem varanda') &&
        !cleanLine.includes('triplo');

      if (isTargetMatch) roomMatches.push({ row: roomRowIndex, text: joined.trim() });
    }

    if (!roomMatches.length) {
      throw new Error('Não encontrei o bloco do quarto contendo: "' + roomHint + '".');
    }

    var roomStart = roomMatches[0].row;
    var roomEnd = grid.length;

    function isLabelLine(lineLower) {
      return [
        'tarif', 'estadia', 'fechado para', 'invent', 'dispon', 'bloque',
        'acomoda', 'preço para o adulto', 'preco para o adulto'
      ].some(function (keyword) { return lineLower.includes(keyword); });
    }

    for (var boundaryRowIndex = roomStart + 1; boundaryRowIndex < grid.length; boundaryRowIndex++) {
      var lineLower = (grid[boundaryRowIndex] || []).map(normalizeCell).join(' ').toLowerCase();
      if (!lineLower) continue;

      var looksLikeRoomTitle = lineLower.includes('suíte') ||
        lineLower.includes('suite') ||
        /\buh\d+\b/i.test(lineLower);

      if (looksLikeRoomTitle && !lineLower.includes(hint) && !isLabelLine(lineLower)) {
        roomEnd = boundaryRowIndex;
        break;
      }
    }

    var labelIndex = {};
    var labelsWanted = [
      { key: 'price', names: ['tarifário base', 'tarifario base', 'base rate', 'tarifa base'] },
      { key: 'adult3', names: ['preço para o adulto 3', 'preco para o adulto 3', 'adult 3'] },
      { key: 'minstay', names: ['estadia mínima', 'estadia minima', 'minimum stay', 'min stay'] },
      { key: 'cta', names: ['fechado para chegada', 'closed to arrival', 'cta'] },
      { key: 'ctd', names: ['fechado para partida', 'closed to departure', 'ctd'] }
    ];

    for (var labelRowIndex = roomStart; labelRowIndex < roomEnd; labelRowIndex++) {
      var haystack = (grid[labelRowIndex] || []).map(normalizeCell).join(' ').toLowerCase();
      if (!haystack) continue;

      for (var wantedIndex = 0; wantedIndex < labelsWanted.length; wantedIndex++) {
        var wanted = labelsWanted[wantedIndex];
        if (labelIndex[wanted.key] != null) continue;
        if (wanted.names.some(function (name) { return haystack.includes(name); })) {
          labelIndex[wanted.key] = labelRowIndex;
        }
      }
    }

    var requiredKeys = ['price', 'adult3', 'minstay', 'cta', 'ctd'];
    var missing = requiredKeys.filter(function (key) { return labelIndex[key] == null; });
    if (missing.length) {
      var previewLines = [];
      var maxPreview = Math.min(roomEnd, roomStart + 40);
      for (var previewIndex = roomStart; previewIndex < maxPreview; previewIndex++) {
        var previewText = (grid[previewIndex] || []).map(normalizeCell).filter(Boolean).join(' | ');
        if (previewText) previewLines.push('L' + (previewIndex + 1) + ': ' + previewText);
      }
      throw new Error(
        'Encontrei o quarto "' + roomHint + '", mas não encontrei as linhas: ' + missing.join(', ') + '.\n\n' +
        'Prévia do bloco:\n' + previewLines.join('\n')
      );
    }

    function getByRowAndDates(sourceRowIndex) {
      var sourceRow = grid[sourceRowIndex] || [];
      return dateIndices.map(function (dateColumnIndex) {
        return normalizeCell(sourceRow[dateColumnIndex] == null ? '' : sourceRow[dateColumnIndex]);
      });
    }

    var prices = getByRowAndDates(labelIndex.price).map(parseMoney);
    var adult3 = getByRowAndDates(labelIndex.adult3).map(parseMoney).map(function (value) { return Math.round(value); });
    var minimumStays = getByRowAndDates(labelIndex.minstay).map(parseIntSafe);
    var arrivals = getByRowAndDates(labelIndex.cta).map(parseBool01);
    var departures = getByRowAndDates(labelIndex.ctd).map(parseBool01);

    var lastValid = -1;
    for (var priceIndex = 0; priceIndex < prices.length; priceIndex++) {
      if (prices[priceIndex] > 0) lastValid = priceIndex;
    }

    for (var lockIndex = lastValid + 1; lockIndex < prices.length; lockIndex++) {
      prices[lockIndex] = 0;
      adult3[lockIndex] = 0;
      minimumStays[lockIndex] = 0;
      arrivals[lockIndex] = 1;
      departures[lockIndex] = 1;
    }

    var startDate = isoDates[0];
    var endDate = isoDates[isoDates.length - 1];
    var lockedAfter = lastValid >= 0 ? isoDates[lastValid] : '(nenhuma data válida)';
    var daily = {};

    for (var dailyIndex = 0; dailyIndex < isoDates.length; dailyIndex++) {
      daily[isoDates[dailyIndex]] = {
        base: Number(prices[dailyIndex] || 0),
        extra: Number(adult3[dailyIndex] || 0),
        minStay: Number(minimumStays[dailyIndex] || 0),
        cta: Number(arrivals[dailyIndex] || 0),
        ctd: Number(departures[dailyIndex] || 0)
      };
    }

    var json = {
      version: version,
      updatedAt: updatedAt,
      messageTemplate: messageTemplate,
      daily: daily
    };

    var roomMatchesLog = roomMatches.map(function (match) {
      return '  - L' + (match.row + 1) + ': ' + match.text;
    }).join('\n');

    var log =
      'Arquivo interpretado:\n' +
      '- Linha de datas: ' + (bestRowIndex + 1) + ' (encontrei ' + bestCount + ' datas)\n' +
      '- Quarto alvo: "' + roomHint + '"\n' +
      '- Bloco escolhido: L' + (roomStart + 1) + '\n' +
      '- Candidatos encontrados:\n' + (roomMatchesLog || '  - nenhum') + '\n' +
      '- Bloco analisado: linhas ' + (roomStart + 1) + ' até ' + roomEnd + ' (aprox.)\n\n' +
      'Linhas encontradas:\n' +
      '- Tarifário base:         L' + (labelIndex.price + 1) + '\n' +
      '- Preço adulto 3 (extra): L' + (labelIndex.adult3 + 1) + '\n' +
      '- Estadia mínima:         L' + (labelIndex.minstay + 1) + '\n' +
      '- Fechado p/ Chegada:     L' + (labelIndex.cta + 1) + '\n' +
      '- Fechado p/ Partida:     L' + (labelIndex.ctd + 1) + '\n\n' +
      'JSON oficial:\n' +
      '- version: ' + version + '\n' +
      '- updatedAt: ' + updatedAt + '\n' +
      '- messageTemplate: ' + messageTemplate.length + ' caracteres\n' +
      '- datas em daily: ' + isoDates.length + '\n\n' +
      'Regra de segurança aplicada:\n' +
      '- Última data com preço > 0: ' + lockedAfter + '\n' +
      '- A partir do dia seguinte: base=0, extra=0, minStay=0, CTA=1, CTD=1\n';

    return {
      csv: buildCsv(daily),
      json: json,
      startDate: startDate,
      endDate: endDate,
      lockedAfter: lockedAfter,
      log: log
    };
  }

  global.TariffConverter = Object.freeze({
    readFile: readFile,
    readXLSXAsGrid: readXLSXAsGrid,
    readCSVAsGrid: readCSVAsGrid,
    parseCSVToGrid: parseCSVToGrid,
    convertGrid: convertGrid,
    buildCsv: buildCsv
  });
})(window);
