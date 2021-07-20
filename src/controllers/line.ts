import { Request, Response } from 'express';
import { Types, LeanDocument } from 'mongoose';
import { v2 } from 'cloudinary';
import { config } from '../config/config';
import { IImageFile, KeyModel } from '../models/key';
import { ILine, LineModel } from '../models/line';
import { SupplierModel } from '../models/supplier';

v2.config({
    cloud_name: config.CLOUDINARY.NAME,
    api_key: config.CLOUDINARY.KEY,
    api_secret: config.CLOUDINARY.SECRET,
});

export async function saveLine({ user, body }: Request, res: Response) {
    if (!user?.roleIncludes(['GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (!body?.supplier) return res.status(400).send({ message: 'Client has not sent params' });

    body.supplier = await SupplierModel.findByIdentifier(body.supplier).catch(() => {
        return res.status(400).send({ message: 'Client has not sent params' });
    });

    new LineModel(body).save((err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!data) return res.status(204).send({ message: 'Saved and is not returning any content' });
        return res.status(200).send({ data });
    });
}

export function listLine({ user, query }: Request, res: Response) {
    if (!user?.roleIncludes(['READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (query?.page) {
        const page = !isNaN(Number(query.page)) ? Number(query.page) : 1;
        const pipeline = new Array<unknown>({
            $lookup: {
                from: 'suppliers',
                localField: 'supplier',
                foreignField: '_id',
                as: 'supplier'
            }
        }, {
            $unwind: {
                path: '$supplier',
            }
        });

        if (!!query?.regex && (query.regex as string).length < 7) {
            const line = (query.regex as string).slice(0, 3);
            pipeline.push({
                $match: {
                    identifier: {
                        $regex: `^${line}`,
                        $options: 'i'
                    }
                }
            });
            if ((query.regex as string).length > 3) {
                const supplier = (query.regex as string).slice(3, 6);
                pipeline.push({
                    $match: {
                        'supplier.identifier': {
                            $regex: `^${supplier}`,
                            $options: 'i'
                        }
                    }
                });
            }
        }

        LineModel.aggregate(pipeline.concat({
            $facet: {
                data: [{
                    $project: {
                        identifier: {
                            $concat: ['$identifier', '$supplier.identifier']
                        },
                        name: 1
                    }
                }, {
                    $sort: {
                        identifier: 1
                    }
                }, {
                    $skip: config.LIMIT.LINE * (page - 1)
                }, {
                    $limit: config.LIMIT.LINE
                }],
                total: [{
                    $group: {
                        _id: null,
                        count: {
                            $sum: 1
                        }
                    }
                }]
            }
        }, {
            $unwind: {
                path: '$total'
            }
        }, {
            $project: {
                data: 1,
                totalDocs: '$total.count'
            }
        })).exec(async (err, [locations]: { data: LeanDocument<ILine>[]; totalDocs: number }[]) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!locations)
                return res.status(404).send({ message: 'Document not found' });

            let { data, totalDocs } = locations;
            if (query?.count === 'key')
                data = await Promise.all(data.map(async line => {
                    return {
                        ...line,
                        countKeys: await LineModel.totalKey(line._id)
                    }
                }));

            const totalPages = Math.ceil(totalDocs / config.LIMIT.LINE);
            const hasNextPage = totalPages > page;
            const hasPrevPage = page > 1;
            return res.status(200).send({
                data,
                metadata: {
                    totalDocs,
                    limit: config.LIMIT.LINE,
                    page,
                    nextPage: hasNextPage ? page + 1 : null,
                    prevPage: hasPrevPage ? page - 1 : null,
                    hasNextPage,
                    hasPrevPage,
                    totalPages
                }
            });
        });
    } else if (query?.id) {
        LineModel
            .findOne()
            .where('_id')
            .equals(query.id)
            .select(['identifier', 'supplier'])
            .populate('supplier', 'identifier')
            .exec(async (err, data) => {
                if (err)
                    return res.status(409).send({ message: 'Internal error, probably error with params' });
                if (!data)
                    return res.status(404).send({ message: 'Document not found' });

                const doc = data.toObject();
                if (query?.count === 'key')
                    doc.countKeys = await LineModel.totalKey(data._id);

                return res.status(200).send({ data: doc });
            });
    } else {
        LineModel
            .find()
            .select(['identifier', 'supplier'])
            .populate('supplier', 'identifier')
            .exec(async (err, data) => {
                if (err)
                    return res.status(409).send({ message: 'Internal error, probably error with params' });
                if (!data)
                    return res.status(404).send({ message: 'Document not found' });

                let docs = data.map(line => line.toObject());
                if (query?.count === 'key')
                    docs = await Promise.all(docs.map(async line => {
                        return {
                            ...line,
                            countKeys: await LineModel.totalKey(line._id)
                        }
                    }));

                return res.status(200).send({ data: docs });
            });
    }
}

export async function updateLine({ user, query, body }: Request, res: Response) {
    if (!user?.roleIncludes(['EDIT', 'GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (!Types.ObjectId.isValid(<string>query?.id) || !body?.supplier)
        return res.status(400).send({ message: 'Client has not sent params' });

    body.supplier = await SupplierModel.findByIdentifier(body.supplier).catch(() => {
        return res.status(400).send({ message: 'Client has not sent params' });
    });

    LineModel.findOneAndUpdate({ _id: query.id }, body, { new: true })
        .exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });
            return res.status(200).send({ data });
        });
}

export function deleteLine({ user, query }: Request, res: Response) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({ message: 'Access denied' });
    if (Types.ObjectId.isValid(<string>query?.id))
        return res.status(400).send({ message: 'Client has not sent params' });
    LineModel.findOneAndDelete({ _id: query.id })
        .exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });
            if (query?.force === 'delete' && await KeyModel.exists({ line: data._id })) {
                try {
                    const keys = await KeyModel.findAndDeleteMany({ line: data._id });
                    await Promise.all(
                        keys.map(async k => await Promise.all(
                            k.image
                                .filter(i => i.public_id)
                                .map(async i => {
                                    return await v2.uploader.destroy(<string>i.public_id)
                                })
                        ))
                    );
                } catch {
                    return res.status(409).send({ message: 'Batch removal process has failed' });
                }
            }
            return res.status(200).send({ data });
        });
}

export async function resetLine({ user, params, body }: Request, res: Response) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({ message: 'Access denied' });
    if (!Types.ObjectId.isValid(params?.id))
        return res.status(400).send({ message: 'Client has not sent params' });

    const image = new Array<LeanDocument<IImageFile>>();
    if (!isNaN(body?.status) && body.status >= 0 && body.status < 5)
        for (let idN = 0; idN < 3; idN++)
            image.push({ idN, status: body.status });

    const keys = await KeyModel.find({
        line: params.id,
        image: {
            $gt: []
        }
    }).select('image -_id');

    KeyModel.updateMany({
        line: params.id,
        image: {
            $gt: []
        }
    }, {
        $set: {
            image
        }
    }).exec(async (err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (data.nModified === 0)
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
        return res.status(200).send({ data: keys });
    });
}