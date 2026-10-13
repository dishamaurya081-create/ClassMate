/**
 * ClassMate Timetable PDF Importer  (v2 — All-Sections)
 *
 * Dynamically extracts ALL CSE-section timetables from the canonical college PDF:
 *   timetable-source/timetable.pdf
 *
 * Reusable: drop in an updated PDF and run `npm run import:timetable`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PDF_PATH        = path.join(PROJECT_ROOT, 'timetable-source', 'timetable.pdf');
const TARGET_DATA_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'timetable.ts');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTime(t) {
  if (!t) return '';
  const clean = t.trim().replace('.', ':');
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (h < 8) h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeDay(dayStr) {
  const d = dayStr.trim().toLowerCase();
  if (d.startsWith('mon')) return 'Monday';
  if (d.startsWith('tue')) return 'Tuesday';
  if (d.startsWith('wed')) return 'Wednesday';
  if (d.startsWith('thu')) return 'Thursday';
  if (d.startsWith('fri')) return 'Friday';
  if (d.startsWith('sat')) return 'Saturday';
  if (d.startsWith('sun')) return 'Sunday';
  return dayStr.trim();
}

function detectSectionOnPage(fullText) {
  const m = fullText.match(/\bCSE\s*[-\u2013\s]?\s*(1[0-9]|20)\b/i);
  if (!m) return null;
  return `CSE-${m[1]}`;
}

function parseTimeRange(text) {
  const clean = text.replace(/\s/g, '');
  const m = clean.match(/(\d{1,2}[.:]\d{2})\s*[-\u2013]\s*(\d{1,2}[.:]\d{2})/);
  if (!m) return null;
  return { start: normalizeTime(m[1]), end: normalizeTime(m[2]) };
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

const BASE_SUBJECT_MAP = {
  '25BOE 312': 'DSTL',
  '25OE3'    : 'DSTL',
  '25CS301'  : 'OOPS',
  '25CS302'  : 'Operating Systems',
  '25CS303'  : 'Advance Data Structure',
  '25CS351'  : 'OOPS WITH C++ LAB',
  '25CS352'  : 'OS LAB',
  '25CS353'  : 'ADVANCED DATA STRUCTURES LAB',
  '25VA301'  : 'Data Visualisation',
  '25VA309'  : 'Employability Skills',
  '25VA351'  : 'FSD Workshop -1',
  '25VA352'  : 'Holistic Skills & Innovation-3',
  '25HU302'  : 'Technical Communication',
  'TC' : 'Technical Communication',
  'ES' : 'Employability Skills',
  'VA' : 'Verbal Ability',
  'HSI': 'Holistic Skills & Innovation-3',
  'FSD': 'FSD Workshop -1',
};

const BASE_FACULTY_MAP = {
  'DK' : 'Mr. Dhaneshwar Kumar (DK)',
  'DM' : 'Ms. Divya Maheswari (DM)',
  'PSG': 'Ms. Pooja Singhal (PSG)',
  'DMP': 'Dr. Disha Mohini Pathak (DMP)',
  'SOS': 'Dr. Somya Srivastava (SOS)',
  'SW' : 'Ms. Swati Sheron (SW)',
  'VV' : 'Mr. Varun Kumar (VV)',
  'MJ' : 'Ms. Mokshi Juyal (MJ)',
  'LS' : 'Ms. Laxmi Saraswat (LS)',
  'AT' : 'Dr. Abhrity Thakur (AT)',
  'KA' : 'Dr. Kadambri Agarwal (KA)',
  'ASG': 'Ms. Astha Goyal (ASG)',
};

function resolveTeacher(raw, facultyMap) {
  if (!raw) return '';
  const t = raw.trim();
  if (facultyMap[t]) return facultyMap[t];
  if (t.includes('/') || t.includes('+') || t.includes(',')) {
    return t.split(/[\/+,]/).map(p => p.trim()).map(p => facultyMap[p] || p).join(' / ');
  }
  return t;
}

function resolveSubject(raw, subjectMap) {
  if (!raw) return raw;
  const t = raw.trim();
  if (subjectMap[t]) return subjectMap[t];
  for (const [code, name] of Object.entries(subjectMap)) {
    if (t.startsWith(code)) return name;
  }
  return t;
}

function guessType(courseCode, subjectName) {
  const s = (subjectName || '').toUpperCase();
  const c = (courseCode || '').toUpperCase();
  if (s.includes('LAB') || c.includes('35')) return 'lab';
  if (s.includes('WORKSHOP') || s.includes('FSD') || s.includes('HSI')) return 'workshop';
  if (s.includes('DATA VISUALI') || s.includes('CLOUD') || s.includes('FCC')) return 'workshop';
  if (s.includes('SKILL') || s.includes('ES') || s.includes('VA')) return 'skill';
  return 'lecture';
}

function augmentFacultyFromLegend(items, facultyMap) {
  const legendItems = items.filter(it => it.y < 200 && it.y > 50);
  for (const it of legendItems) {
    if (it.text.includes('+') || it.text.includes(',')) continue;
    const m = it.text.match(/^([A-Za-z\s.]+?)\s*\(([A-Z]{2,4})\)$/);
    if (m && !facultyMap[m[2]]) facultyMap[m[2]] = it.text;
  }
}

// ─── Cell Parsing ─────────────────────────────────────────────────────────────

function parseSingleEntry(tokens, section, dayName, startTime, endTime, idCounters, facultyMap, subjectMap) {
  let courseCode = '', subjectName = '', teacherRaw = '', room = '', batch;

  for (const tok of tokens) {
    if (!courseCode && /^25[A-Z]{2,3}\s*\d{3}/i.test(tok)) {
      courseCode  = tok;
      subjectName = resolveSubject(tok, subjectMap);
      continue;
    }
    if (/^G[12]$/i.test(tok)) { batch = tok.toUpperCase() === 'G1' ? 'G1' : 'G2'; continue; }
    if (/^(BATCH[-\s]?1|DV\s*BATCH[-\s]?1)$/i.test(tok)) { batch = 'Batch-1'; subjectName = subjectName || 'Data Visualisation (Batch 1)'; if (!courseCode) courseCode = '25VA301'; continue; }
    if (/^(BATCH[-\s]?2|DV\s*BATCH[-\s]?2)$/i.test(tok)) { batch = 'Batch-2'; subjectName = subjectName || 'Data Visualisation (Batch 2)'; if (!courseCode) courseCode = '25VA301'; continue; }
    if (/^FCC$/i.test(tok)) { batch = 'FCC'; subjectName = subjectName || 'Fundamentals of Cloud Computing'; if (!courseCode) courseCode = '25VA301'; continue; }
    if (!room && /^(KC|Lab|MB|LH|BH|AH|SH|TH|Room)\s*[-]?\s*\d+/i.test(tok)) { room = tok; continue; }
    if (!teacherRaw && /^[A-Z]{2,4}(,\s*[A-Z]{2,4})*$/.test(tok) && facultyMap[tok]) { teacherRaw = tok; continue; }
    if (/^(TC|ES|VA|HSI|FSD)$/.test(tok) && !subjectName) { subjectName = resolveSubject(tok, subjectMap); courseCode = courseCode || tok; continue; }
    if (!teacherRaw && /^[A-Z]{2,4}$/.test(tok)) teacherRaw = tok;
  }

  if (!subjectName && !courseCode) return null;

  const teacher = resolveTeacher(teacherRaw, facultyMap);
  const type    = guessType(courseCode, subjectName);
  const dayPrefix = dayName.substring(0, 3).toLowerCase();
  const batchSuffix = batch === 'G1' ? '-g1' : batch === 'G2' ? '-g2' : batch === 'Batch-1' ? '-b1' : batch === 'Batch-2' ? '-b2' : batch === 'FCC' ? '-fcc' : '';
  const key = `${section}-${dayPrefix}`;
  idCounters[key] = (idCounters[key] || 0) + 1;
  const id = `${section.toLowerCase()}-${dayPrefix}-${idCounters[key]}${batchSuffix}`;

  const result = { id, section, day: dayName, subject: subjectName || courseCode, courseCode, teacher, room, startTime, endTime, type };
  if (batch) result.batch = batch;
  return result;
}

function parseCellLines(lines, section, dayName, startTime, endTime, idCounters, facultyMap, subjectMap) {
  const results = [];
  const full = lines.join(' ');
  if (!full.trim()) return results;

  // Try splitting on course-code boundaries
  const coursePattern = /(?=\b25[A-Z]{2,3}\s*\d{3}|\bDV\s*BATCH|\bFCC\b|\bG[12]\b|\bTC\b|\bES\b|\bVA\b|\bHSI\b|\bFSD\b)/i;
  const parts = full.split(coursePattern).filter(p => p.trim().length > 1);
  const entries = parts.length > 1 ? parts : [full];

  for (const entry of entries) {
    const tokens = entry.split(/\s*\/\s*|\s*\|\s*|\n|\s{2,}/).map(t => t.trim()).filter(Boolean);
    const cls = parseSingleEntry(tokens, section, dayName, startTime, endTime, idCounters, facultyMap, subjectMap);
    if (cls) results.push(cls);
  }
  return results;
}

// ─── Per-Page Extraction ──────────────────────────────────────────────────────

async function extractSectionPage(page, sectionName, facultyMap, subjectMap) {
  const content = await page.getTextContent();
  const items   = content.items
    .map(it => ({
      text: it.str.trim(),
      x   : Math.round(it.transform[4] * 10) / 10,
      y   : Math.round(it.transform[5] * 10) / 10,
    }))
    .filter(it => it.text.length > 0);

  // Augment faculty legend
  augmentFacultyFromLegend(items, facultyMap);

  // Find time anchor
  const anchorItem = items.find(it => /^08[.:]\s*5[05]/.test(it.text));
  if (!anchorItem) { console.warn(`  ⚠ No time anchor for ${sectionName}`); return []; }

  const headerY = anchorItem.y;
  const tol = 20;

  // Parse time-slot headers
  const timeSlots = items
    .filter(it => Math.abs(it.y - headerY) <= tol)
    .sort((a, b) => a.x - b.x)
    .map(it => ({ x: it.x, ...parseTimeRange(it.text) }))
    .filter(ts => ts.start && ts.end);

  if (timeSlots.length < 4) { console.warn(`  ⚠ Only ${timeSlots.length} time slots for ${sectionName}`); return []; }

  const colXs = timeSlots.map(t => t.x);
  colXs.push(colXs[colXs.length - 1] + 90);

  // Find day labels
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayItems = items.filter(it => DAYS.includes(it.text)).sort((a, b) => b.y - a.y);
  if (dayItems.length === 0) { console.warn(`  ⚠ No day labels for ${sectionName}`); return []; }

  const rowBands = dayItems.map((di, idx) => ({
    day : normalizeDay(di.text),
    yMax: di.y + 8,
    yMin: idx + 1 < dayItems.length ? dayItems[idx + 1].y - 8 : 0,
  }));

  const gridTop = anchorItem.y - 2;

  // Collect cell items
  const cellMap = {};
  for (const it of items) {
    if (it.y >= gridTop) continue;
    if (DAYS.includes(it.text)) continue;
    if (/^\d{1,2}[.:]\d{2}/.test(it.text)) continue;
    if (it.y < 60) continue; // skip footer

    const band = rowBands.find(rb => it.y <= rb.yMax && it.y >= rb.yMin);
    if (!band) continue;

    let slotIdx = -1;
    for (let i = 0; i < colXs.length - 1; i++) {
      if (it.x >= colXs[i] - 8 && it.x < colXs[i + 1]) { slotIdx = i; break; }
    }
    if (slotIdx < 0 || slotIdx >= timeSlots.length) continue;

    const key = `${band.day}|${slotIdx}`;
    if (!cellMap[key]) cellMap[key] = [];
    cellMap[key].push(it.text);
  }

  // Parse cells
  const classes = [];
  const idCounters = {};
  for (const [key, lines] of Object.entries(cellMap)) {
    const [dayName, slotIdxStr] = key.split('|');
    const slot = timeSlots[parseInt(slotIdxStr, 10)];
    if (!slot) continue;
    const parsed = parseCellLines(lines, sectionName, dayName, slot.start, slot.end, idCounters, facultyMap, subjectMap);
    classes.push(...parsed);
  }

  return classes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function importTimetable() {
  console.log('════════════════════════════════════════════════════');
  console.log('  ClassMate PDF Importer — All Sections             ');
  console.log('════════════════════════════════════════════════════\n');

  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found: ${PDF_PATH}\nPlace timetable PDF at timetable-source/timetable.pdf`);
  }

  const dataBuffer = fs.readFileSync(PDF_PATH);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(dataBuffer) }).promise;
  console.log(`[1] Loaded PDF — ${doc.numPages} pages.\n`);

  console.log('[2] Scanning for section pages…');
  const sectionPages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    const fullText = (await pg.getTextContent()).items.map(i => i.str).join(' ');
    const sec = detectSectionOnPage(fullText);
    if (sec && !sectionPages.find(s => s.section === sec)) {
      sectionPages.push({ section: sec, pageNum: p, page: pg });
      console.log(`    ✓ Page ${p}: ${sec}`);
    }
  }

  if (sectionPages.length === 0) throw new Error('No CSE sections found in PDF.');
  console.log(`\n    Found ${sectionPages.length} sections: ${sectionPages.map(s => s.section).join(', ')}\n`);

  console.log('[3] Extracting class entries…');
  const allClasses = [];
  const facultyMap = { ...BASE_FACULTY_MAP };
  const subjectMap = { ...BASE_SUBJECT_MAP };

  for (const { section, pageNum, page } of sectionPages) {
    const sectionClasses = await extractSectionPage(page, section, facultyMap, subjectMap);
    console.log(`    ${section} (pg ${pageNum}): ${sectionClasses.length} entries`);
    allClasses.push(...sectionClasses);
  }

  if (allClasses.length === 0) throw new Error('No class entries extracted. PDF layout may differ — review import script.');

  console.log(`\n    Total: ${allClasses.length} entries across ${sectionPages.length} sections.\n`);

  console.log('[4] Writing src/data/timetable.ts…');
  const generatedAt = new Date().toISOString();
  const sectionsFound = [...new Set(allClasses.map(c => c.section))].sort();

  const tsContent = `import type { ClassItem } from '../types/timetable';
import { getAvailableSections } from '../types/timetable';

/**
 * Official timetable data — sections: ${sectionsFound.join(', ')}
 * Extracted from: timetable-source/timetable.pdf
 * Generated at: ${generatedAt}
 *
 * DO NOT EDIT MANUALLY. Run: npm run import:timetable
 */
export const OFFICIAL_TIMETABLE_DATA: ClassItem[] = ${JSON.stringify(allClasses, null, 2)};

export const DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const STANDARD_PERIODS = [
  { label: 'Period 1', time: '08:50 - 09:40' },
  { label: 'Period 2', time: '09:40 - 10:30' },
  { label: 'Break',    time: '10:30 - 10:40', isBreak: true },
  { label: 'Period 3', time: '10:40 - 11:30' },
  { label: 'Period 4', time: '11:30 - 12:20' },
  { label: 'Lunch',    time: '12:20 - 13:10', isBreak: true },
  { label: 'Period 5', time: '13:10 - 14:00' },
  { label: 'Period 6', time: '14:00 - 14:50' },
  { label: 'Period 7', time: '14:50 - 15:40' },
  { label: 'Period 8', time: '15:40 - 16:30' },
];

/** @deprecated Use OFFICIAL_TIMETABLE_DATA */
export const INITIAL_CSE15_TIMETABLE = OFFICIAL_TIMETABLE_DATA;

/** Returns sections present in timetable data (replaces hardcoded ACTIVE_SECTION). */
export function getAvailableSectionsFromData(): string[] {
  return getAvailableSections(OFFICIAL_TIMETABLE_DATA);
}
`;

  fs.writeFileSync(TARGET_DATA_FILE, tsContent, 'utf-8');
  const kb = (fs.statSync(TARGET_DATA_FILE).size / 1024).toFixed(1);
  console.log(`    ✓ Written (${kb} KB)\n`);

  console.log('════════════════════════════════════════════════════');
  console.log('  IMPORT COMPLETE');
  console.log('════════════════════════════════════════════════════');
  for (const sec of sectionsFound) {
    const count = allClasses.filter(c => c.section === sec).length;
    console.log(`  ${sec.padEnd(10)}: ${count} entries`);
  }
  console.log('\n  All detected sections will show as "Available" in ClassMate.\n');
}

importTimetable().catch(err => {
  console.error('\nImport failed:', err.message || err);
  process.exit(1);
});
