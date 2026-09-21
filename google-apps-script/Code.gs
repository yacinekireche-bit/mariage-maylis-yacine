const SHEET_NAME = 'RSVP';
const HEADERS = [
  'Identifiant',
  'Date de réponse',
  'Nom et prénom',
  'E-mail',
  'Téléphone',
  'Présence',
  '+1',
  'Nom du +1',
  'Nombre d’enfants',
  'Noms des enfants',
  'Restrictions alimentaires',
  'Accessibilité / précisions',
  'Message'
];

function setupSheet() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt(
    'Configuration RSVP',
    'Saisissez une longue clé secrète. Vous devrez mettre exactement la même valeur dans Netlify.',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer.getSelectedButton() !== ui.Button.OK || !answer.getResponseText().trim()) return;

  PropertiesService.getScriptProperties().setProperty('RSVP_SECRET', answer.getResponseText().trim());
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#e8eadc');
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  ui.alert('La feuille RSVP est prête.');
}

function clean(value) {
  const text = String(value ?? '').trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const request = JSON.parse(event.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('RSVP_SECRET');
    if (!expectedSecret || request.secret !== expectedSecret) return json({ ok: false, error: 'unauthorized' });

    const data = request.data || {};
    if (!data.id || !data.name || !data.email) return json({ ok: false, error: 'invalid' });

    lock.waitLock(10000);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) return json({ ok: false, error: 'sheet_missing' });

    const existing = sheet.getRange('A:A').createTextFinder(String(data.id)).matchEntireCell(true).findNext();
    if (existing) return json({ ok: true, id: data.id, duplicate: true });

    const attending = data.attending === 'yes';
    sheet.appendRow([
      clean(data.id),
      new Date(),
      clean(data.name),
      clean(data.email),
      clean(data.phone),
      attending ? 'Oui' : 'Non',
      attending && data.plusOne ? 'Oui' : 'Non',
      attending && data.plusOne ? clean(data.companion) : '',
      attending ? Number(data.children || 0) : 0,
      attending ? clean(data.childrenNames) : '',
      attending ? clean(data.dietary) : '',
      attending ? clean(data.accessibility) : '',
      clean(data.message)
    ]);
    return json({ ok: true, id: data.id });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: 'server_error' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

