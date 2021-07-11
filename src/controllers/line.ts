import { Request, Response } from 'express';
import { LeanDocument } from 'mongoose';
import { v2 } from 'cloudinary';
import { config } from '../config/config';
import { KeyModel } from '../models/key';
import { ILine, LineModel } from '../models/line';
import { SupplierModel } from '../models/supplier';

v2.config({
    cloud_name: config.CLOUDINARY.NAME,
    api_key: config.CLOUDINARY.KEY,
    api_secret: config.CLOUDINARY.SECRET,
});

export async function saveLine({ body }: Request, res: Response) {
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

export function listLine({ query }: Request, res: Response) {
    if (query.page) {
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
        }, {
            $project: {
                'supplier.createdAt': 0,
                'supplier.updatedAt': 0,
                'supplier.__v': 0,
                createdAt: 0,
                updatedAt: 0,
                __v: 0
            }
        });

        if (!!query?.regex && (query?.regex as string).length < 7) {
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
            $skip: config.LIMIT.LINE * (page - 1)
        }, {
            $limit: config.LIMIT.LINE
        }, {
            $sort: {
                identifier: 1,
                'supplier.identifier': 1
            }
        })).exec(async (err, data: LeanDocument<ILine>[]) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });

            if (query?.count === 'key')
                data = await Promise.all(data.map(async line => {
                    return {
                        ...line,
                        countKeys: await LineModel.totalKey(line._id)
                    }
                }));

            const metadata = await LineModel.paginate(config.LIMIT.LINE, page, pipeline)
            return res.status(200).send({ data, metadata });
        });
    } else if (query.id) {
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

export async function updateLine({ query, body }: Request, res: Response) {
    if (!query?.id || !body?.supplier) return res.status(400).send({ message: 'Client has not sent params' });

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

export function deleteLine({ query }: Request, res: Response) {
    if (!query?.id) return res.status(400).send({ message: 'Client has not sent params' });
    LineModel.findOneAndDelete({ _id: query.id })
        .exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });
            if (query?.force === 'delete' && await KeyModel.exists({ line: data._id })) {
                const keys = await KeyModel.find({ line: data._id }).select('image -_id');
                await KeyModel.deleteMany({ line: data._id }).exec(async err => {
                    if (err)
                        return res.status(409).send({ message: 'Batch removal process has failed' });
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
                });
            }
            return res.status(200).send({ data });
        });
}

export async function resetLineStatus(req: Request, res: Response) {
    // const status = Number(req.body.status);
    // if (!req.params.identifier) return res.status(400).send({ message: 'Client has not sent params' });
    // const query: MongooseFilterQuery<IKey> = { 'line': req.params.identifier };
    // const image = new Array<IImage>();
    // if (status < 5) for (let idN = 1; idN < 4; idN++) image.push(<IImage>{ idN, status });
    // const update: UpdateQuery<IKey> = { $set: { image } };
    // Key.find(query).exec((err, key: Array<IKey>) => Key.updateMany(query, update, async err => {
    //     if (err) return res.status(409).send({ message: 'Batch update process has failed' });
    //     if (!key) return res.status(404).send({ message: 'Document not found' });
    //     await Promise.all(
    //         key.map(async k => await Promise.all(
    //             k.image.filter(i => i.publicId).map(async i => await v2.uploader.destroy(<string>i.publicId))
    //         ))
    //     );
    //     return res.status(200).send({ data: key });
    // }));
}