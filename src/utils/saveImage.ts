import { mkdirSync, writeFileSync } from 'fs';
import { LeanDocument } from 'mongoose';
import { extname, resolve } from 'path';
import { IKey } from '../models/key';

export function saveImage(
    idN: number,
    { line, code }: LeanDocument<IKey>,
    { buffer }: Express.Multer.File
) {
    const image = code + ' ' + idN + '.jpg';
    const directory = resolve(
        __dirname,
        '../../public',
        line.trim(),
    );
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, image), buffer, 'hex');
}