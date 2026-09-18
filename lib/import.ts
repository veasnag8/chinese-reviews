export function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n');
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

export function parseExcel(file: File): Promise<string[][]> {
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        resolve(json as string[][]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export type WordImportRow = {
  chinese: string;
  pinyin?: string;
  khmer?: string;
  english?: string;
  hsk_level?: number;
  class_id?: string;
};

export type SentenceImportRow = {
  chinese_sentence: string;
  pinyin?: string;
  khmer_translation?: string;
  english_translation?: string;
  class_id?: string;
};

export function mapWordRow(row: string[], headers: string[]): WordImportRow | null {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
  
  const chinese = obj['chinese'] || obj['word'] || obj['hanzi'] || '';
  if (!chinese) return null;
  
  return {
    chinese,
    pinyin: obj['pinyin'] || undefined,
    khmer: obj['khmer'] || obj['km'] || undefined,
    english: obj['english'] || obj['en'] || undefined,
    hsk_level: obj['hsk'] || obj['hsk_level'] ? parseInt(obj['hsk'] || obj['hsk_level']) : undefined,
    class_id: obj['class_id'] || obj['class'] || undefined,
  };
}

export function mapSentenceRow(row: string[], headers: string[]): SentenceImportRow | null {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
  
  const chinese = obj['chinese'] || obj['sentence'] || obj['chinese_sentence'] || '';
  if (!chinese) return null;
  
  return {
    chinese_sentence: chinese,
    pinyin: obj['pinyin'] || undefined,
    khmer_translation: obj['khmer'] || obj['km'] || obj['khmer_translation'] || undefined,
    english_translation: obj['english'] || obj['en'] || obj['english_translation'] || undefined,
    class_id: obj['class_id'] || obj['class'] || undefined,
  };
}

export function exportToCSV(data: any[], headers: string[]): string {
  const escapeCell = (cell: any) => {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  
  const headerRow = headers.map(escapeCell).join(',');
  const rows = data.map(row => headers.map(h => escapeCell(row[h])).join(','));
  const csv = [headerRow, ...rows].join('\n');
  // Add UTF-8 BOM for proper Khmer/Unicode support in Excel
  return '\uFEFF' + csv;
}

export function exportToExcel(data: any[], headers: string[], filename: string): void {
  const XLSX = require('xlsx');
  const worksheetData = [headers, ...data.map(row => headers.map(h => row[h] || ''))];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Words');
  XLSX.writeFile(workbook, filename);
}