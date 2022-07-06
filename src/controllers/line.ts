import { Request, Response } from 'express';
import { existsSync, unlinkSync } from 'fs';
import { isValidObjectId, LeanDocument, Types } from 'mongoose';
import { resolve } from 'path';
import { config } from '../config';
import { IKey, KeyModel } from '../models/key';
import { ILine, LineModel } from '../models/line';
import { SupplierModel } from '../models/supplier';

export async function saveLine(
    { user, body }: Omit<Request, 'body'> & {
        body: LeanDocument<ILine>
    },
    res: Response
) {
    if (!user?.roleIncludes('GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!body?.supplier)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const data = await new LineModel({
            ...body,
            supplier: await SupplierModel.findByIdentifier(body.supplier)
        }).save();
        if (!data) return res.status(204).send({
            message: 'Saved and is not returning any content'
        });
        return res.status(200).send({ data });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function listLine(
    {
        user,
        query: { page: _page, identifier, name, count, id: _id }
    }: Request & {
        query: {
            page?: string;
            identifier?: string;
            name?: string;
            count?: 'key';
            id?: string;
        }
    },
    res: Response
) {
    if (!user?.roleIncludes('READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    try {
        if (!!_page) {
            const page = !isNaN(Number(_page)) ? Number(_page) : 1;
            type response = {
                data: LeanDocument<ILine>[];
                totalDocs: number;
            };
            const [{ data, totalDocs }] = await LineModel.aggregate<response>()
                .lookup({
                    from: 'suppliers',
                    localField: 'supplier',
                    foreignField: '_id',
                    as: 'supplier'
                })
                .unwind('$supplier')
                .project({
                    identifier: {
                        $concat: [
                            '$identifier',
                            '$supplier.identifier'
                        ]
                    },
                    name: 1,
                })
                .match({
                    ...(
                        (identifier || name) &&
                        {
                            $and: [
                                ...identifier
                                    ? [
                                        {
                                            identifier: {
                                                $regex: identifier,
                                                $options: 'i',
                                            }
                                        }
                                    ]
                                    : [],
                                ...name
                                    ? [
                                        {
                                            name: {
                                                $regex: name,
                                                $options: 'i',
                                            }
                                        }
                                    ]
                                    : [],
                            ],
                        }
                    ),
                })
                .facet({
                    data: [
                        {
                            $sort: {
                                identifier: 1
                            }
                        },
                        {
                            $skip: config.LIMIT.LINE * (page - 1)
                        },
                        {
                            $limit: config.LIMIT.LINE
                        },
                    ],
                    total: [
                        {
                            $group: {
                                _id: null,
                                count: {
                                    $sum: 1
                                }
                            }
                        },
                    ]
                })
                .project({
                    data: 1,
                    total: {
                        $cond: {
                            if: {
                                $eq: ['$total', []]
                            },
                            then: 0,
                            else: '$total.count'
                        }
                    },
                })
                .unwind('$total');
            if (data.length < 1)
                return res.status(404).send({
                    message: 'Document not found'
                });
            const totalPages = Math.ceil(totalDocs / config.LIMIT.LINE);
            const hasNextPage = totalPages > page;
            const hasPrevPage = page > 1;
            return res.status(200).send({
                data: await Promise.all(
                    data.map(async line => {
                        return {
                            ...line,
                            ...(
                                count === 'key' &&
                                {
                                    countKeys: await LineModel.totalKey(line._id)
                                }
                            ),
                        };
                    })
                ),
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
        }
        if (isValidObjectId(_id)) {
            const [data] = await LineModel.aggregate<LeanDocument<ILine>>()
                .match({ _id: new Types.ObjectId(_id) })
                .lookup({
                    from: 'suppliers',
                    localField: 'supplier',
                    foreignField: '_id',
                    as: 'supplier'
                })
                .unwind('$supplier')
                .project({
                    identifier: {
                        $concat: [
                            '$identifier',
                            '$supplier.identifier'
                        ]
                    },
                });
            if (!data)
                return res.status(404).send({
                    message: 'Document not found'
                });
            return res.status(200).send({
                data: {
                    ...data,
                    ...(
                        count === 'key' &&
                        {
                            countKeys: await LineModel.totalKey(data._id)
                        }
                    ),
                },
            });
        }
        const data = await LineModel.aggregate<LeanDocument<ILine>>()
            .lookup({
                from: 'suppliers',
                localField: 'supplier',
                foreignField: '_id',
                as: 'supplier'
            })
            .unwind('$supplier')
            .project({
                identifier: {
                    $concat: [
                        '$identifier',
                        '$supplier.identifier'
                    ]
                },
            });
        if (data.length < 1)
            return res.status(404).send({
                message: 'Document not found'
            });
        return res.status(200).send({
            data: await Promise.all(
                data.map(async line => {
                    return {
                        ...line,
                        ...(
                            count === 'key' &&
                            {
                                countKeys: await LineModel.totalKey(line._id)
                            }
                        ),
                    };
                })
            ),
        });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function updateLine(
    {
        user,
        query: { id: _id },
        body,
    }: Omit<Request, 'body'> & {
        query: {
            id?: string
        };
        body: LeanDocument<ILine>;
    },
    res: Response
) {
    if (!user?.roleIncludes('EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!isValidObjectId(_id) || !body?.supplier)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const { modifiedCount } = await LineModel.updateOne(
            { _id },
            {
                ...body,
                supplier: await SupplierModel.findByIdentifier(body.supplier),
            }
        );
        if (modifiedCount !== 1)
            return res.status(404).send({
                message: 'Document not found'
            });
        const [data] = await LineModel.aggregate<LeanDocument<ILine>>()
            .match({ _id: new Types.ObjectId(_id) })
            .lookup({
                from: 'suppliers',
                localField: 'supplier',
                foreignField: '_id',
                as: 'supplier'
            })
            .unwind('$supplier')
            .project({
                identifier: {
                    $concat: [
                        '$identifier',
                        '$supplier.identifier'
                    ]
                },
                name: 1,
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

export async function deleteLine(
    {
        user,
        query: { id: _id, force }
    }: Request & {
        query: {
            id?: string;
            force?: 'delete'
        };
    },
    res: Response
) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!isValidObjectId(_id))
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const [data] = await LineModel.aggregate<LeanDocument<ILine>>()
            .match({ _id: new Types.ObjectId(_id) })
            .lookup({
                from: 'suppliers',
                localField: 'supplier',
                foreignField: '_id',
                as: 'supplier'
            })
            .unwind('$supplier')
            .project({
                identifier: {
                    $concat: [
                        '$identifier',
                        '$supplier.identifier'
                    ]
                },
                name: 1,
            });
        if (!data)
            return res.status(404).send({
                message: 'Document not found'
            });
        const { deletedCount } = await LineModel.deleteOne({ _id });
        if (deletedCount !== 1)
            return res.status(404).send({
                message: 'Document not found'
            });
        if (force === 'delete') {
            const keys = await KeyModel.findAndDeleteMany({ line: data._id });
            //TODO: Revisar si espera a todas estas acciones
            for (const { code, image } of keys) {
                for (const { idN, status } of image) {
                    if (status !== 5)
                        continue;
                    const image = code + ' ' + idN + '.jpg';
                    const file = resolve(
                        __dirname,
                        '../../public',
                        data.identifier.trim(),
                        image,
                    );
                    if (!existsSync(file))
                        continue;
                    unlinkSync(file);
                }
            }
        }
        return res.status(200).send({ data });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function resetLine(
    {
        user,
        params: { id: line },
        body: { status },
    }: Omit<Request, 'body'> & {
        params: {
            id?: string
        };
        body: {
            status?: number
        };
    },
    res: Response
) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!isValidObjectId(line))
        return res.status(400).send({
            message: 'Client has not sent params'
        });

    const total = !!status && !isNaN(status) && status >= 0 && status < 5
        ? 3
        : 0;
    try {
        const data = await KeyModel.aggregate<LeanDocument<IKey>>()
            .match({
                line: new Types.ObjectId(line),
                image: {
                    $gt: []
                }
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
                image: 1,
            });
        if (data.length < 1)
            return res.status(404).send({
                message: 'Document not found'
            });
        const { modifiedCount } = await KeyModel.updateMany(
            {
                line,
                image: {
                    $gt: []
                }
            },
            {
                $set: {
                    image: new Array(total)
                        .fill({ status })
                        .map(({ status }, idN) => {
                            return { idN, status };
                        }),
                }
            }
        );
        if (modifiedCount === 0)
            return res.status(404).send({
                message: 'Document not found'
            });
        //TODO: Revisar si espera a todas estas acciones
        for (const { line, code, image } of data) {
            for (const { idN, status } of image) {
                if (status !== 5)
                    continue;
                const image = code + ' ' + idN + '.jpg';
                const file = resolve(
                    __dirname,
                    '../../public',
                    line.trim(),
                    image,
                );
                if (!existsSync(file))
                    continue;
                unlinkSync(file);
            }
        }
        return res.status(200).send({ data });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}