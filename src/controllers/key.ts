import { Request, Response } from 'express';
import { LeanDocument } from 'mongoose';
import { v2 } from 'cloudinary';
import { config } from '../config/config';
import { IImageFile, IKey, KeyModel } from '../models/key';
import { LineModel } from '../models/line';

v2.config({
    cloud_name: config.CLOUDINARY.NAME,
    api_key: config.CLOUDINARY.KEY,
    api_secret: config.CLOUDINARY.SECRET,
});

export async function saveKey({ body }: Request, res: Response) {
    if (!body?.line) return res.status(400).send({ message: 'Client has not sent params' });

    body.line = await LineModel.findByIdentifier(body.line).catch(() => {
        return res.status(400).send({ message: 'Client has not sent params' });
    });

    const newKey = new KeyModel(body);
    if (!isNaN(body?.status)) {
        for (let idN = 0; idN < 3; idN++)
            newKey.image.push(<IImageFile>{ idN, status: body.status });
    }

    newKey.save((err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!data) return res.status(204).send({ message: 'Saved and is not returning any content' });
        return res.status(200).send({ data });
    });
}

export async function listKey({ query }: Request, res: Response) {
    if (query.page) {
        const page = !isNaN(Number(query.page)) ? Number(query.page) : 1;
        const pipeline = new Array<unknown>({
            $lookup: {
                from: 'lines',
                localField: 'line',
                foreignField: '_id',
                as: 'line'
            }
        }, {
            $unwind: {
                path: '$line'
            }
        }, {
            $lookup: {
                from: 'suppliers',
                localField: 'line.supplier',
                foreignField: '_id',
                as: 'line.supplier'
            }
        }, {
            $unwind: {
                path: '$line.supplier'
            }
        }, {
            $project: {
                'line.identifier': 1,
                'line.supplier.identifier': 1,
                code: 1,
                desc: 1,
                image: 1
            }
        });

        if ((query?.regex as string)?.length < 11) {
            const line = (query.regex as string).slice(0, 3);
            pipeline.push({
                $match: {
                    'line.identifier': {
                        $regex: `^${line}`,
                        $options: 'i'
                    }
                }
            });
            if ((query.regex as string).length > 3) {
                const supplier = (query.regex as string).slice(3, 6);
                pipeline.push({
                    $match: {
                        'line.supplier.identifier': {
                            $regex: `^${supplier}`,
                            $options: 'i'
                        }
                    }
                });
            }
            if ((query.regex as string).length > 6) {
                const code = (query.regex as string).slice(6, 10);
                pipeline.push({
                    $match: {
                        code: {
                            $regex: `^${code}`,
                            $options: 'i'
                        }
                    }
                });
            }
        } else if (query?.desc) {
            pipeline.push({
                $match: {
                    desc: {
                        $regex: query.desc,
                        $options: 'i'
                    }
                }
            });
        }

        KeyModel.aggregate(pipeline.concat({
            $skip: config.LIMIT.KEY * (page - 1)
        }, {
            $limit: config.LIMIT.KEY
        }, {
            $sort: {
                'line.identifier': 1,
                'line.supplier.identifier': 1,
                code: 1
            }
        })).exec(async (err, data: LeanDocument<IKey>[]) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });

            const { status, percentage } = await KeyModel.infoStatus(pipeline);

            const paginateMetadata = await KeyModel.paginate(config.LIMIT.LINE, page, pipeline)
            return res.status(200).send({
                data,
                metadata: {
                    ...paginateMetadata,
                    status,
                    percentage,
                }
            });
        });
    } else if (query.id) {
        KeyModel
            .findOne()
            .where('_id')
            .equals(query.id)
            .populate({
                path: 'line',
                select: 'identifier',
                populate: {
                    path: 'supplier',
                    select: 'identifier',
                }
            })
            .exec((err, data) => {
                if (err)
                    return res.status(409).send({ message: 'Internal error, probably error with params' });
                if (!data)
                    return res.status(404).send({ message: 'Document not found' });
                return res.status(200).send({ data });
            });
    } else {
        KeyModel
            .find()
            .populate({
                path: 'line',
                select: 'identifier',
                populate: {
                    path: 'supplier',
                    select: 'identifier',
                }
            })
            .exec((err, data) => {
                if (err)
                    return res.status(409).send({ message: 'Internal error, probably error with params' });
                if (!data)
                    return res.status(404).send({ message: 'Document not found' });
                return res.status(200).send({ data });
            });
    }
}

export async function updateKey({ body, query }: Request, res: Response) {
    if (!query?.id || !body?.line) return res.status(400).send({ message: 'Client has not sent params' });

    body.line = await LineModel.findByIdentifier(body.line).catch(() => {
        return res.status(400).send({ message: 'Client has not sent params' });
    });

    KeyModel.findOneAndUpdate({ _id: query.id }, body)
        .exec((err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });
            return res.status(200).send({ data });
        });
}

export function deleteKey({ query }: Request, res: Response) {
    if (!query?.id) return res.status(400).send({ message: 'Client has not sent params' });
    KeyModel.findOneAndDelete({ _id: query.id })
        .exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });

            await Promise.all(
                data.image
                    .filter(i => i.public_id)
                    .map(async i => {
                        return await v2.uploader
                            .destroy(<string>i.public_id)
                            .catch(e => e);
                    })
            ).catch(() => {
                return res.status(409).send({ message: 'Batch removal process has failed' });
            });
            return res.status(200).send({ data });
        });
}

export async function resetKey({ query, body }: Request, res: Response) {
    if (query?.id) {
        const status = Number(body.status);
        const image = new Array<LeanDocument<IImageFile>>();
        if (status < 5)
            for (let idN = 1; idN < 4; idN++)
                image.push({ idN, status });

        KeyModel.findOneAndUpdate({
            _id: query.id
        }, {
            $set: {
                image
            }
        }).exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });

            await Promise.all(
                data.image
                    .filter(i => i.public_id)
                    .map(async i => {
                        return await v2.uploader
                            .destroy(<string>i.public_id)
                            .catch(e => e);
                    })
            ).catch(() => {
                return res.status(409).send({ message: 'Batch removal process has failed' });
            });
            return res.status(200).send({ data });
        });
    } else {
        const keys = await KeyModel.find({
            image: {
                $gt: []
            }
        }).select('image -_id');

        KeyModel.updateMany({
            image: {
                $gt: []
            }
        }, {
            $set: {
                image: []
            }
        }).exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });

            await Promise.all(
                keys.map(async k => await Promise.all(
                    k.image
                        .filter(i => i.public_id)
                        .map(async i => {
                            return await v2.uploader
                                .destroy(<string>i.public_id)
                                .catch(e => e);
                        })
                ))
            ).catch(() => {
                return res.status(409).send({ message: 'Batch removal process has failed' });
            });
            return res.status(200).send({ data });
        });
    }
}