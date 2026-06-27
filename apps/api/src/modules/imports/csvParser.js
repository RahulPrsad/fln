function toCamelHeader(header) {
  const normalized = String(header ?? '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();

  const headerMap = {
    displayname: 'displayName',
    name: 'displayName',
    studentname: 'displayName',
    externalstudentid: 'externalStudentId',
    externalid: 'externalStudentId',
    studentid: 'externalStudentId',
    admissionnumber: 'admissionNumber',
    admissionno: 'admissionNumber',
    rollnumber: 'rollNumber',
    rollno: 'rollNumber',
    dateofbirth: 'dateOfBirth',
    dob: 'dateOfBirth',
    gender: 'gender'
  };

  return headerMap[normalized] ?? normalized;
}

function parseRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted && character === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && character === ',') {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += character;
  }

  row.push(cell.trim());
  if (row.some((value) => value !== '')) {
    rows.push(row);
  }

  return rows;
}

export function parseCsv(text) {
  const rows = parseRows(String(text ?? ''));
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(toCamelHeader);
  return rows.slice(1).map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = row[index] ?? '';
      return record;
    }, {})
  );
}
