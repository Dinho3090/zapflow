// ─────────────────────────────────────────────────────────
// lib/phoneFilter.js — Normalização de telefones (BR + UY)
// Porta do filters.py original
// ─────────────────────────────────────────────────────────

export function normalizePhone(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return null;

  // Remove prefixo de operadora (021, etc.)
  if (n.length > 11 && n.startsWith('0')) n = n.slice(3);

  if (n.startsWith('598')) {
    // Uruguai — já formatado
  } else if (n.startsWith('09') && n.length === 9) {
    n = `598${n.slice(1)}`;
  } else if (n.startsWith('9') && n.length === 8) {
    n = `598${n}`;
  } else {
    // Brasil
    if (!n.startsWith('55') && (n.length === 10 || n.length === 11)) {
      n = `55${n}`;
    }
    // Remove 9º dígito para DDDs <= 28
    if (n.startsWith('55') && n.length === 13) {
      const ddd = parseInt(n.slice(2, 4), 10);
      if (ddd <= 28) n = n.slice(0, 4) + n.slice(5);
    }
  }

  if (n.startsWith('55')  && (n.length < 12 || n.length > 13)) return null;
  if (n.startsWith('598') && (n.length < 11 || n.length > 12)) return null;
  return n;
}

export function parseCSV(buffer) {
  let text;
  try       { text = buffer.toString('utf-8'); }
  catch (_) { text = buffer.toString('latin1'); }

  return text.split(/\r?\n/).reduce((acc, line) => {
    if (!line.trim()) return acc;
    const sep   = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) return acc;
    const phone = normalizePhone(parts[1]);
    if (!phone) return acc;
    acc.push({ name: parts[0] || `📱 ${phone}`, phone });
    return acc;
  }, []);
}

export function parseVCF(buffer) {
  let text;
  try       { text = buffer.toString('utf-8'); }
  catch (_) { text = buffer.toString('latin1'); }

  text = text.replace(/=\r?\n/g, ''); // unfold quoted-printable
  const contacts = [];

  for (const card of text.split(/BEGIN:VCARD/i)) {
    if (!/END:VCARD/i.test(card)) continue;

    const telMatch = card.match(/^TEL[^:]*:(.+)$/mi);
    if (!telMatch) continue;
    const phone = normalizePhone(telMatch[1]);
    if (!phone) continue;

    const fnLine = card.match(/^(FN[^:]*):(.*)/mi);
    const nLine  = card.match(/^(N[^:]*):(.*)/mi);
    const [tag, rawName] = fnLine
      ? [fnLine[1], fnLine[2]]
      : nLine ? [nLine[1], nLine[2]] : ['', ''];

    let name = rawName.replace(/;/g, ' ').trim();

    // Decodifica Quoted-Printable
    if (/QUOTED-PRINTABLE/i.test(tag) && name) {
      try {
        name = Buffer.from(
          name.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        ).toString('utf-8');
      } catch (_) { /* mantém raw */ }
    }

    if (!name || /VERSION/i.test(name)) name = `📱 ${phone}`;
    contacts.push({ name: name.trim(), phone });
  }
  return contacts;
}

export function interpolate(template, contact) {
  if (!template) return '';
  const vars = { nome: contact.name || 'cliente', telefone: contact.phone, ...contact.variables };
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
