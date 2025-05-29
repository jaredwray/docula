import fs from 'node:fs';
import path from 'node:path';

const initTsFilePath = path.join('src', 'init.ts');
const initFolderPath = path.join('init');

const initFiles = fs.readdirSync(initFolderPath);

fs.rmSync(initTsFilePath, {force: true});

let initFileContent = '/* eslint-disable @stylistic/max-len */\r\n\r\n';

for (const file of initFiles) {
	const fileName = file.replaceAll('.', '');
	const filePath = path.join(initFolderPath, file);
	const fileContent = fs.readFileSync(filePath).toString('base64');
	initFileContent += `export const ${fileName} = "${fileContent}";\r\n\r\n`;
}

fs.writeFileSync(initTsFilePath, initFileContent);

console.log('init file generated successfully at src/init.ts');
