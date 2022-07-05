import { Request, Response } from 'express';
import { existsSync, unlinkSync } from 'fs';
import { isValidObjectId, LeanDocument, Types } from 'mongoose';
import { resolve } from 'path';
import { config } from '../config';
import { IKey, KeyModel } from '../models/key';
import { LineModel } from '../models/line';

export async function saveKey(
    { user, body }: Omit<Request, 'body'> & {
        body: LeanDocument<IKey> & {
            status?: number;
        };
    },
    res: Response
) {
    if (!user?.roleIncludes('GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!body?.line)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    const newKey = new KeyModel({
        ...body,
        line: await LineModel.findByIdentifier(body.line),
        ...(
            (
                !!body?.status &&
                !isNaN(body.status) &&
                body.status >= 0 &&
                body.status < 5
            ) &&
            {
                image: new Array(3)
                    .fill({ status: body.status })
                    .map(({ status }, idN) => {
                        return { idN, status };
                    })
            }
        )
    });
    newKey.save((err, data) => {
        if (err)
            return res.status(409).send({
                message: 'Internal error, probably error with params'
            });
        if (!data)
            return res.status(204).send({
                message: 'Saved and is not returning any content'
            });
        return res.status(200).send({ data });
    });
}



export function listKey(
    {
        user,
        query: { page, code, desc, status, id: _id }
    }: Request & {
        query: {
            page?: string | number;
            code?: string;
            desc?: string;
            status?: string | number;
            id?: string;
        }
    },
    res: Response
) {
    if (!user?.roleIncludes('READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!!page) {
        page = !isNaN(Number(page)) ? Number(page) : 1;
        status = Number(status);
        type response = {
            data: LeanDocument<IKey>[];
            totalDocs: number;
        };
        KeyModel.aggregate<response>()
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
            })
            .match({
                ...(
                    (code || desc || !isNaN(status)) &&
                    {
                        $and: [
                            ...code
                                ? [
                                    {
                                        code: {
                                            $regex: code,
                                            $options: 'i',
                                        }
                                    }
                                ]
                                : [],
                            ...desc
                                ? [
                                    {
                                        desc: {
                                            $regex: desc,
                                            $options: 'i',
                                        }
                                    }
                                ]
                                : [],
                            ...(status >= 0 && status <= 5)
                                ? [
                                    {
                                        'image.status': status
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
                            code: 1
                        }
                    },
                    {
                        $skip: config.LIMIT.KEY * (page - 1)
                    },
                    {
                        $limit: config.LIMIT.KEY
                    }
                ],
                total: [
                    {
                        $group: {
                            _id: null,
                            count: {
                                $sum: 1
                            }
                        }
                    }
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
                }
            })
            .unwind('$total')
            .exec((err, [{ data, totalDocs }]) => {
                if (err || typeof page !== 'number')
                    return res.status(409).send({
                        message: 'Internal error, probably error with params'
                    });
                if (data.length < 1)
                    return res.status(404).send({
                        message: 'Document not found'
                    });

                const totalPages = Math.ceil(totalDocs / config.LIMIT.KEY);
                const hasNextPage = totalPages > page;
                const hasPrevPage = page > 1;
                return res.status(200).send({
                    data,
                    metadata: {
                        totalDocs,
                        limit: config.LIMIT.KEY,
                        page,
                        nextPage: hasNextPage ? page + 1 : null,
                        prevPage: hasPrevPage ? page - 1 : null,
                        hasNextPage,
                        hasPrevPage,
                        totalPages
                    }
                });
            });

    } else if (isValidObjectId(_id)) {
        KeyModel.aggregate<LeanDocument<IKey>>()
            .match({
                _id: new Types.ObjectId(_id)
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
            //TODO: Revisar si esta es la respuesta correcta

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
            })
            .exec(async (err, [data]) => {
                if (err)
                    return res.status(409).send({
                        message: 'Internal error, probably error with params'
                    });
                if (!data)
                    return res.status(404).send({
                        message: 'Document not found'
                    });
                return res.status(200).send({ data });
            });
    } else {
        KeyModel.aggregate<LeanDocument<IKey>>()
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
            //TODO: Revisar si esta es la respuesta correcta

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
            })
            .exec((err, data) => {
                if (err)
                    return res.status(409).send({
                        message: 'Internal error, probably error with params'
                    });
                if (data.length < 1)
                    return res.status(404).send({
                        message: 'Document not found'
                    });
                return res.status(200).send({ data });
            });
    }
}

export async function updateKey(
    {
        user,
        query: { id: _id },
        body,
    }: Omit<Request, 'body'> & {
        query: {
            id?: string;
        };
        body?: LeanDocument<IKey>;
    },
    res: Response
) {
    if (!user?.roleIncludes('EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!isValidObjectId(_id) || !body?.line)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    KeyModel.updateOne(
        { _id },
        {
            ...body,
            line: LineModel.findByIdentifier(body.line),
        }
    ).exec((err, { modifiedCount }) => {
        if (err || modifiedCount !== 1)
            return res.status(409).send({
                message: 'Internal error, probably error with params'
            });
        KeyModel.aggregate<LeanDocument<IKey>>()
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
            })
            .exec((err, [data]) => {
                if (err)
                    return res.status(409).send({
                        message: 'Internal error, probably error with params'
                    });
                if (!data)
                    return res.status(404).send({
                        message: 'Document not found'
                    });
                return res.status(200).send({ data });
            });
    });
}

export function deleteKey(
    {
        user,
        query: { id: _id },
    }: Request & {
        query: {
            id?: string;
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
    KeyModel.aggregate<LeanDocument<IKey>>()
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
                    '$line.supplier.identifier',
                ]
            },
            code: 1,
            image: 1,
        })
        .exec((err, [data]) => {
            if (err)
                return res.status(409).send({
                    message: 'Internal error, probably error with params'
                });
            if (!data)
                return res.status(404).send({
                    message: 'Document not found'
                });
            KeyModel.deleteOne({ _id })
                .exec((err, { deletedCount }) => {
                    if (err || deletedCount !== 1)
                        return res.status(409).send({
                            message: 'Internal error, probably error with params'
                        });
                    for (const { idN, status } of data.image) {
                        if (status !== 5)
                            continue;
                        const image = data.code + ' ' + idN + '.jpg';
                        const file = resolve(
                            __dirname,
                            "../../public",
                            data.line.trim(),
                            image,
                        );
                        if (!existsSync(file))
                            continue;
                        unlinkSync(file);
                    }
                    return res.status(200).send({ data });
                });
        });
}

export async function resetKey(
    {
        user,
        query: { id: _id },
        body: { status },
    }: Omit<Request, 'body'> & {
        query: {
            id?: string;
        };
        body: {
            status?: number;
        };
    },
    res: Response
) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    const total = !!status && !isNaN(status) && status >= 0 && status < 5
        ? 3
        : 0;
    const image = new Array(total)
        .fill({ status })
        .map(({ status }, idN) => {
            return { idN, status };
        });
    if (isValidObjectId(_id)) {
        KeyModel.aggregate<LeanDocument<IKey>>()
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
                        '$line.supplier.identifier',
                    ]
                },
                code: 1,
                image: 1,
            })
            .exec((err, [data]) => {
                if (err)
                    return res.status(409).send({
                        message: 'Internal error, probably error with params'
                    });
                if (!data)
                    return res.status(404).send({
                        message: 'Document not found'
                    });
                KeyModel.updateOne(
                    { _id },
                    { $set: { image } }
                ).exec((err, { modifiedCount }) => {
                    if (err || modifiedCount === 0)
                        return res.status(409).send({
                            message: 'Internal error, probably error with params'
                        });
                    for (const { idN, status } of data.image) {
                        if (status !== 5)
                            continue;
                        const image = data.code + ' ' + idN + '.jpg';
                        const file = resolve(
                            __dirname,
                            "../../public",
                            data.line.trim(),
                            image,
                        );
                        if (!existsSync(file))
                            continue;
                        unlinkSync(file);
                    }
                    return res.status(200).send({ data });
                });
            });
    } else {
        KeyModel.aggregate<LeanDocument<IKey>>()
            .match({ image: { $gt: [] } })
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
            })
            .exec((err, data) => {
                if (err)
                    return res.status(409).send({
                        message: 'Internal error, probably error with params'
                    });
                if (data.length < 1)
                    return res.status(404).send({
                        message: 'Document not found'
                    });
                KeyModel.updateMany(
                    { image: { $gt: [] } },
                    { $set: { image } }
                ).exec((err, { modifiedCount }) => {
                    if (err || modifiedCount === 0)
                        return res.status(409).send({
                            message: 'Internal error, probably error with params'
                        });
                    for (const { line, code, image } of data) {
                        for (const { idN, status } of image) {
                            if (status !== 5)
                                continue;
                            const image = code + ' ' + idN + '.jpg';
                            const file = resolve(
                                __dirname,
                                "../../public",
                                line.trim(),
                                image,
                            );
                            if (!existsSync(file))
                                continue;
                            unlinkSync(file);
                        }
                    }
                    return res.status(200).send({ data });
                });
            });
    }
}

export function keysInfo(
    {
        user,
        query: { code, desc, status, id: _id }
    }: Request & {
        query: {
            code?: string;
            desc?: string;
            status?: string | number;
            id?: string;
        }
    },
    res: Response
) {
    if (!user?.roleIncludes('READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    status = Number(status);
    type response = {
        status: {
            defective: number;
            found: number;
            photographed: number;
            prepared: number;
            edited: number;
            saved: number;
        };
        success: number;
    };
    KeyModel.aggregate<response>()
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
        })
        .match({
            ...(
                (code || desc || !isNaN(status)) &&
                {
                    $and: [
                        ...code
                            ? [
                                {
                                    code: {
                                        $regex: code,
                                        $options: 'i',
                                    }
                                }
                            ]
                            : [],
                        ...desc
                            ? [
                                {
                                    desc: {
                                        $regex: desc,
                                        $options: 'i',
                                    }
                                }
                            ]
                            : [],
                        ...(status >= 0 && status <= 5)
                            ? [
                                {
                                    'image.status': status
                                }
                            ]
                            : [],
                    ],
                }
            ),
        })
        .facet({
            status: [
                {
                    $unwind: {
                        path: '$image'
                    }
                },
                {
                    $sortByCount: '$image.status'
                }
            ],
            success: [
                {
                    $unwind: {
                        path: '$image'
                    }
                },
                {
                    $match: {
                        'image.status': 5
                    }
                },
                {
                    $group: {
                        _id: {
                            line: '$line',
                            code: '$code'
                        },
                        image: {
                            $first: '$image'
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: {
                            $sum: 1
                        }
                    }
                }
            ],
        })
        .project({
            status: {
                $cond: {
                    if: {
                        $eq: ['$status', []]
                    },
                    then: {},
                    else: {
                        $arrayToObject: {
                            $map: {
                                input: '$status',
                                as: 'st',
                                in: {
                                    k: {
                                        $switch: {
                                            branches: [{
                                                case: {
                                                    $eq: ['$$st._id', 0]
                                                },
                                                then: 'defective'
                                            }, {
                                                case: {
                                                    $eq: ['$$st._id', 1]
                                                },
                                                then: 'found'
                                            }, {
                                                case: {
                                                    $eq: ['$$st._id', 2]
                                                },
                                                then: 'photographed'
                                            }, {
                                                case: {
                                                    $eq: ['$$st._id', 3]
                                                },
                                                then: 'prepared'
                                            }, {
                                                case: {
                                                    $eq: ['$$st._id', 4]
                                                },
                                                then: 'edited'
                                            }, {
                                                case: {
                                                    $eq: ['$$st._id', 5]
                                                },
                                                then: 'saved'
                                            }],
                                            default: 'status'
                                        }
                                    },
                                    v: '$$st.count'
                                }
                            }
                        }
                    }
                }
            },
            success: {
                $cond: {
                    if: {
                        $eq: ['$success', []]
                    },
                    then: 0,
                    else: '$success.count'
                }
            }
        })
        .unwind('$success')
        .project({
            status: {
                defective: {
                    $ifNull: ['$status.defective', 0]
                },
                found: {
                    $ifNull: ['$status.found', 0]
                },
                photographed: {
                    $ifNull: ['$status.photographed', 0]
                },
                prepared: {
                    $ifNull: ['$status.prepared', 0]
                },
                edited: {
                    $ifNull: ['$status.edited', 0]
                },
                saved: {
                    $ifNull: ['$status.saved', 0]
                }
            },
            success: 1,
        })
        .exec((err, [data]) => {
            if (err)
                return res.status(409).send({
                    message: 'Internal error, probably error with params'
                });
            return res.status(200).send({ data });
        });
}

export function nextLast(
    {
        user,
        params: { code },
    }: Request & {
        params: {
            code?: string;
        }
    },
    res: Response
) {
    if (!user?.roleIncludes('READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!code || !/^([A-Z0-9]{6}|[A-Z0-9]{5}\s)[A-Z0-9]{4}$/.test(code))
        return res.status(400).send({
            message: 'Client has not sent params'
        });

    KeyModel.aggregate<LeanDocument<IKey>>()
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
        })
        .sort('code')
        .match({
            code: {
                $gt: code.toUpperCase()
            }
        })
        .limit(1)
        .exec((err, [data]) => {
            if (err)
                return res.status(409).send({
                    message: 'Internal error, probably error with params'
                });
            if (!data)
                return res.status(404).send({
                    message: 'Document not found'
                });
            return res.status(200).send({ data });
        })
}