import AdmZip from 'adm-zip';
import { rmSync } from 'node:fs';

rmSync('dist/function.zip', { force: true });
const zip = new AdmZip();
zip.addLocalFile('dist/index.js'); // placed at zip root
zip.writeZip('dist/function.zip');
console.log('wrote dist/function.zip');
