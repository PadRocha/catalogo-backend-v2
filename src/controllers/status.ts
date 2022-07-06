import { Request, Response } from 'express';
import { isValidObjectId, LeanDocument, Types } from 'mongoose';
import { IKey, KeyModel } from '../models/key';

export async function updateStatus(
    {
        user,
        params: { id: _id, idN },
        body: { status }
    }: Omit<Request, 'body'> & {
        params: {
            id: string;
            idN: string;
        };
        body: {
            status?: number;
        };
    },
    res: Response
) {
    if (!user?.roleIncludes('EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });

    if (!isValidObjectId(_id) || !idN || !/[0-2]/.test(idN))
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        if (!!status && !isNaN(status)) {
            if (status < 0 || status > 5)
                return res.status(400).send({
                    message: 'Client has not sent params'
                });
            const { modifiedCount: keysSetted } = await KeyModel.updateOne(
                {
                    _id,
                    'image.idN': Number(idN)
                },
                { $set: { 'image.$.status': status } }
            );
            if (keysSetted !== 1) {
                const { modifiedCount: keysPushed } = await KeyModel.updateOne(
                    {
                        _id,
                        'image.idN': {
                            $ne: Number(idN)
                        }
                    },
                    {
                        $push: {
                            image: {
                                idN: Number(idN),
                                status,
                            }
                        }
                    }
                );
                if (keysPushed !== 1)
                    return res.status(404).send({
                        message: 'Document not found'
                    });
                const [data] = await KeyModel.aggregate<LeanDocument<IKey>>()
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
                        code: {
                            $concat: [
                                '$line.identifier',
                                '$line.supplier.identifier',
                                '$code'
                            ]
                        },
                        desc: 1,
                        image: 1
                    });
                if (!data)
                    return res.status(404).send({
                        message: 'Document not found'
                    });
                return res.status(200).send({ data });
            }
            const [data] = await KeyModel.aggregate<LeanDocument<IKey>>()
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
                    code: {
                        $concat: [
                            '$line.identifier',
                            '$line.supplier.identifier',
                            '$code'
                        ]
                    },
                    desc: 1,
                    image: 1
                });
            if (!data)
                return res.status(404).send({
                    message: 'Document not found'
                });
            return res.status(200).send({ data });
        }
        const { modifiedCount: keysPulled } = await KeyModel.updateOne(
            { _id },
            {
                $pull: {
                    image: {
                        idN: Number(idN),
                        status: {
                            $gte: 0,
                            $lte: 4
                        }
                    }
                }
            }
        );
        if (keysPulled !== 1)
            return res.status(404).send({
                message: 'Document not found'
            });
        const [data] = await KeyModel.aggregate<LeanDocument<IKey>>()
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
                code: {
                    $concat: [
                        '$line.identifier',
                        '$line.supplier.identifier',
                        '$code'
                    ]
                },
                desc: 1,
                image: 1,
            });
        if (!data)
            return res.status(404).send({
                message: 'Document not found'
            });
        return res.status(200).send({ data });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}