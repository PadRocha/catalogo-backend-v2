import { createCanvas, Image } from 'canvas';
import { Request, Response } from 'express';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { isValidObjectId, LeanDocument, Types } from 'mongoose';
import { resolve } from 'path';
import { IKey, KeyModel } from '../models/key';
import { saveImage } from '../utils/saveImage';

export async function updateImage(
    {
        user,
        params: { id: _id, idN: _idN },
        file
    }: Request & {
        params: {
            id?: string;
            idN?: string;
        };
    },
    res: Response
) {
    if (!user?.roleIncludes('EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!isValidObjectId(_id) || !_idN || !/[0-2]/.test(_idN) || !file)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const idN = Number(_idN);
        const [dataUpdate] = await KeyModel.aggregate<LeanDocument<IKey>>()
            .match({
                _id: new Types.ObjectId(_id),
                'image.idN': idN,
                'image.status': 5,
            })
            .lookup({
                from: 'lines',
                localField: 'line',
                foreignField: '_id',
                as: 'line'
            })
            .unwind('$line')
            .lookup({
                from: 'suppliers',
                localField: 'line.supplier',
                foreignField: '_id',
                as: 'line.supplier'
            })
            .unwind('$line.supplier')
            .project({
                line: {
                    $concat: [
                        '$line.identifier',
                        '$line.supplier.identifier'
                    ]
                },
                code: 1,
            });
        if (!!dataUpdate) {
            saveImage(idN, dataUpdate, file);
            return res.status(200).send({ data: dataUpdate });
        }
        const { modifiedCount } = await KeyModel.updateOne(
            { _id, 'image.idN': idN },
            { $set: { 'image.$.status': 5 } }
        );
        if (modifiedCount !== 1)
            return res.status(404).send({
                message: 'Document not found'
            });
        const [dataSet] = await KeyModel.aggregate<LeanDocument<IKey>>()
            .match({ _id: new Types.ObjectId(_id) })
            .lookup({
                from: 'lines',
                localField: 'line',
                foreignField: '_id',
                as: 'line'
            })
            .unwind('$line')
            .lookup({
                from: 'suppliers',
                localField: 'line.supplier',
                foreignField: '_id',
                as: 'line.supplier'
            })
            .unwind('$line.supplier')
            .project({
                line: {
                    $concat: [
                        '$line.identifier',
                        '$line.supplier.identifier'
                    ]
                },
                code: 1,
            });
        if (!dataSet)
            return res.status(404).send({
                message: 'Document not found'
            });
        saveImage(idN, dataSet, file);
        return res.status(200).send({ data: dataSet });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function displayImage(
    {
        params: { image },
        query: { width, height }
    }: Request & {
        params: {
            image: string;
        };
        query: {
            width?: string;
            height?: string;
        };
    },
    res: Response
) {
    if (!image || !/^([A-Z0-9]{6}|[A-Z0-9]{5}\s)[A-Z0-9]{4}\s[0-2]$/.test(image))
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const [{ image: image_name }] = await KeyModel.aggregate<{ image: string; }>()
            .lookup({
                from: 'lines',
                localField: 'line',
                foreignField: '_id',
                as: 'line'
            })
            .unwind('$line')
            .lookup({
                from: 'suppliers',
                localField: 'line.supplier',
                foreignField: '_id',
                as: 'line.supplier'
            })
            .unwind('$line.supplier')
            .unwind('$image')
            .project({
                _id: 0,
                image: {
                    $concat: [
                        '$line.identifier',
                        '$line.supplier.identifier',
                        '$code',
                        ' ',
                        {
                            $toString: '$image.idN'
                        },
                    ]
                },
            })
            .match({ image });
        if (!image_name)
            return res.status(404).send({
                message: 'Document not found'
            });
        const line = image_name.slice(0, 6).trim();
        const file_image = image_name.slice(6) + '.jpg';
        const path_file = resolve(
            __dirname,
            '../../public',
            line,
            file_image,
        );
        if (!existsSync(path_file))
            return res.status(404).send({
                message: 'Image not found'
            });
        let file = readFileSync(path_file);
        const img = new Image();
        img.onload = () => {
            if (!!width && !!height) {
                const canvas_width = Number(width);
                const canvas_height = Number(height);
                const canvas = createCanvas(canvas_width, canvas_height);
                const ctx = canvas.getContext('2d');
                const { width: image_width, height: image_height } = img;
                ctx.imageSmoothingQuality = 'high';
                ctx.quality = 'best';
                if (
                    (image_height < image_width || image_height > image_width) &&
                    canvas_height < canvas_width
                ) {
                    const new_image_width = (canvas_height * image_width) / image_height;
                    const left_x = (new_image_width - canvas_width) / 2;
                    ctx.drawImage(img, -left_x, 0, new_image_width, canvas_height);
                } else if (
                    (image_height < image_width || image_height > image_width) &&
                    canvas_height > canvas_width
                ) {
                    const new_image_height = (canvas_width * image_height) / image_width;
                    const top_y = (new_image_height - canvas_height) / 2;
                    ctx.drawImage(img, 0, -top_y, canvas_width, new_image_height);
                }
                file = canvas.toBuffer();
            } else if (!!width) {
                const { width: image_width, height: image_height } = img;
                const canvas_width = Number(width);
                const canvas_height = (canvas_width * image_height) / image_width;
                const canvas = createCanvas(canvas_width, canvas_height);
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingQuality = 'high';
                ctx.quality = 'best';
                ctx.drawImage(img, 0, 0, canvas_width, canvas_height);
                file = canvas.toBuffer();
            } else if (!!height) {
                const { width: image_width, height: image_height } = img;
                const canvas_height = Number(height);
                const canvas_width = (canvas_height * image_width) / image_height;
                const canvas = createCanvas(canvas_width, canvas_height);
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingQuality = 'high';
                ctx.quality = 'best';
                ctx.drawImage(img, 0, 0, canvas_width, canvas_height);
                file = canvas.toBuffer();
            }
        };
        img.onerror = () => {
            return res.status(409).send({
                message: 'Internal error'
            });
        };
        img.src = file;
        return res.status(200).contentType('image/jpeg').send(file);
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function deleteImage(
    {
        user,
        params: { id: _id, idN: _idN },
    }: Request & {
        params: {
            id?: string;
            idN?: string;
        };
    },
    res: Response
) {
    if (!user?.roleIncludes('GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!isValidObjectId(_id) || !_idN || !/[0-2]/.test(_idN))
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const idN = Number(_idN);
        const [data] = await KeyModel.aggregate<LeanDocument<IKey>>()
            .match({
                _id: new Types.ObjectId(_id),
                'image.idN': idN,
                'image.status': 5,
            })
            .lookup({
                from: 'lines',
                localField: 'line',
                foreignField: '_id',
                as: 'line'
            })
            .unwind('$line')
            .lookup({
                from: 'suppliers',
                localField: 'line.supplier',
                foreignField: '_id',
                as: 'line.supplier'
            })
            .unwind('$line.supplier')
            .project({
                line: {
                    $concat: [
                        '$line.identifier',
                        '$line.supplier.identifier',
                    ]
                },
                code: 1,
                desc: 1,
                image: 1,
            });
        if (!data)
            return res.status(404).send({
                message: 'Document not found'
            });
        const { modifiedCount } = await KeyModel.updateOne(
            { _id },
            {
                $pull: {
                    image: {
                        idN,
                        status: 5,
                    }
                }
            }
        );
        if (modifiedCount !== 1)
            return res.status(404).send({
                message: 'Document not found'
            });
        const line = data.line.trim();
        const image = data.code + ' ' + idN + '.jpg';
        const file = resolve(
            __dirname,
            '../../public',
            line,
            image,
        );
        if (!existsSync(file))
            return res.status(404).send({
                message: 'Image not found'
            });
        unlinkSync(file);
        return res.status(200).send({ data });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}