// Archive ZIP en STREAMING (méthode « store », sans compression) — 0 dépendance, mémoire quasi nulle.
// Diffuse en flux les en-têtes + le contenu des fichiers (lus par petits morceaux) + le répertoire central.
// Utilise les « data descriptors » (bit 3) pour ne PAS avoir à connaître CRC/taille avant de streamer.
// Adapté aux gros dossiers (le conteneur ne charge jamais tout en mémoire). Offsets 32 bits (dossiers < 4 Go).

import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';

// Table CRC-32 (construite une fois).
let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}
/** Met à jour un CRC-32 en cours (crc initialisé à 0xffffffff, XOR final à la fin). */
function crcUpdate(crc: number, buf: Buffer): number {
  const t = crcTable();
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  return crc >>> 0;
}

/** Liste récursive des fichiers d'un dossier (chemins relatifs POSIX). */
async function listFilesRel(absDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    let ents: import('node:fs').Dirent[];
    try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), rel);
      else if (e.isFile()) out.push(rel);
    }
  }
  await walk(absDir, '');
  return out;
}

const DOS_TIME = 0;
const DOS_DATE = 0x21; // 1980-01-01

interface CentralEntry { nameBytes: Buffer; crc: number; size: number; offset: number; }

/** Renvoie un flux Web (ReadableStream) de l'archive ZIP du dossier `absDir`. */
export function zipDirectoryStream(absDir: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const files = await listFilesRel(absDir);
        const central: CentralEntry[] = [];
        let offset = 0;

        for (const rel of files) {
          const abs = path.join(absDir, rel);
          const nameBytes = Buffer.from(enc.encode(rel));

          // En-tête local : flags 0x0808 (data descriptor + UTF-8), méthode store, CRC/tailles = 0 (dans le descriptor).
          const lh = Buffer.alloc(30);
          lh.writeUInt32LE(0x04034b50, 0);
          lh.writeUInt16LE(20, 4);
          lh.writeUInt16LE(0x0808, 6);
          lh.writeUInt16LE(0, 8);
          lh.writeUInt16LE(DOS_TIME, 10);
          lh.writeUInt16LE(DOS_DATE, 12);
          lh.writeUInt32LE(0, 14); // crc → data descriptor
          lh.writeUInt32LE(0, 18); // taille compressée → data descriptor
          lh.writeUInt32LE(0, 22); // taille brute → data descriptor
          lh.writeUInt16LE(nameBytes.length, 26);
          lh.writeUInt16LE(0, 28);
          const headerOffset = offset;
          controller.enqueue(new Uint8Array(lh));
          controller.enqueue(new Uint8Array(nameBytes));
          offset += 30 + nameBytes.length;

          // Contenu du fichier, lu par morceaux → CRC + taille au fil de l'eau.
          let crc = 0xffffffff;
          let size = 0;
          const stream = createReadStream(abs);
          for await (const chunk of stream as AsyncIterable<Buffer>) {
            crc = crcUpdate(crc, chunk);
            size += chunk.length;
            controller.enqueue(new Uint8Array(chunk));
            offset += chunk.length;
          }
          const finalCrc = (crc ^ 0xffffffff) >>> 0;

          // Data descriptor (CRC + tailles réelles).
          const dd = Buffer.alloc(16);
          dd.writeUInt32LE(0x08074b50, 0);
          dd.writeUInt32LE(finalCrc, 4);
          dd.writeUInt32LE(size, 8);
          dd.writeUInt32LE(size, 12);
          controller.enqueue(new Uint8Array(dd));
          offset += 16;

          central.push({ nameBytes, crc: finalCrc, size, offset: headerOffset });
        }

        // Répertoire central.
        const centralStart = offset;
        let centralSize = 0;
        for (const c of central) {
          const ch = Buffer.alloc(46);
          ch.writeUInt32LE(0x02014b50, 0);
          ch.writeUInt16LE(20, 4);
          ch.writeUInt16LE(20, 6);
          ch.writeUInt16LE(0x0808, 8);
          ch.writeUInt16LE(0, 10);
          ch.writeUInt16LE(DOS_TIME, 12);
          ch.writeUInt16LE(DOS_DATE, 14);
          ch.writeUInt32LE(c.crc, 16);
          ch.writeUInt32LE(c.size, 20);
          ch.writeUInt32LE(c.size, 24);
          ch.writeUInt16LE(c.nameBytes.length, 28);
          ch.writeUInt16LE(0, 30);
          ch.writeUInt16LE(0, 32);
          ch.writeUInt16LE(0, 34);
          ch.writeUInt16LE(0, 36);
          ch.writeUInt32LE(0, 38);
          ch.writeUInt32LE(c.offset, 42);
          controller.enqueue(new Uint8Array(ch));
          controller.enqueue(new Uint8Array(c.nameBytes));
          centralSize += 46 + c.nameBytes.length;
        }

        // Fin du répertoire central (EOCD).
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(0, 4);
        eocd.writeUInt16LE(0, 6);
        eocd.writeUInt16LE(central.length, 8);
        eocd.writeUInt16LE(central.length, 10);
        eocd.writeUInt32LE(centralSize, 12);
        eocd.writeUInt32LE(centralStart, 16);
        eocd.writeUInt16LE(0, 20);
        controller.enqueue(new Uint8Array(eocd));

        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
