import { Request, Response } from 'express';
import { Types, LeanDocument } from 'mongoose';
import { v2 } from 'cloudinary';
import { config } from '../config/config';
import { IImageFile, IKey, keyInfo, KeyModel } from '../models/key';
import { LineModel } from '../models/line';

v2.config({
    cloud_name: config.CLOUDINARY.NAME,
    api_key: config.CLOUDINARY.KEY,
    api_secret: config.CLOUDINARY.SECRET,
});

export async function saveKey({ user, body }: Request, res: Response) {
    if (!user?.roleIncludes(['GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (!body?.line)
        return res.status(400).send({ message: 'Client has not sent params' });

    body.line = await LineModel.findByIdentifier(body.line).catch(() => {
        return res.status(400).send({ message: 'Client has not sent params' });
    });

    const newKey = new KeyModel(body);
    if (!isNaN(body?.status) && body.status >= 0 && body.status < 5) {
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

export async function listKey({ user, query }: Request, res: Response) {
    if (!user?.roleIncludes(['READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (query?.page) {
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
                code: {
                    $concat: ['$line.identifier', '$line.supplier.identifier', '$code']
                },
                desc: 1,
                image: 1
            }
        });

        const $and = new Array<unknown>();

        if (query?.code) {
            $and.push({
                code: {
                    $regex: query.code,
                    $options: 'i'
                }
            });
        }

        if (query?.desc) {
            $and.push({
                desc: {
                    $regex: query.desc,
                    $options: 'i'
                }
            });
        }

        if (query?.status) {
            $and.push({ 'image.status': +query.status });
        }

        if ($and.length > 0) {
            pipeline.push({
                $match: {
                    $and
                }
            });
        }

        KeyModel.aggregate(pipeline.concat({
            $facet: {
                data: [{
                    $sort: {
                        code: 1
                    }
                }, {
                    $skip: config.LIMIT.KEY * (page - 1)
                }, {
                    $limit: config.LIMIT.KEY
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
            $project: {
                data: {
                    $cond: {
                        if: {
                            $eq: ['$data', []]
                        },
                        then: null,
                        else: '$data'
                    }
                },
                total: {
                    $cond: {
                        if: {
                            $eq: ['$total', []]
                        },
                        then: [{
                            count: 0
                        }],
                        else: '$total'
                    }
                },
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
        })).exec((err, [{ data, totalDocs }]: { data: LeanDocument<IKey>[]; totalDocs: number }[]) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });

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
    } else if (query?.id) {
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

export async function updateKey({ user, body, query }: Request, res: Response) {
    if (!user?.roleIncludes(['EDIT', 'GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (!Types.ObjectId.isValid(<string>query?.id) || !body?.line)
        return res.status(400).send({ message: 'Client has not sent params' });

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

export function deleteKey({ user, query }: Request, res: Response) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({ message: 'Access denied' });
    if (!Types.ObjectId.isValid(<string>query?.id))
        return res.status(400).send({ message: 'Client has not sent params' });
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

export async function resetKey({ user, query, body }: Request, res: Response) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({ message: 'Access denied' });
    const image = new Array<LeanDocument<IImageFile>>();
    if (!isNaN(body?.status) && body.status >= 0 && body.status < 5)
        for (let idN = 0; idN < 3; idN++)
            image.push({ idN, status: body.status });

    if (Types.ObjectId.isValid(<string>query?.id)) {
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
        }).select('image');

        KeyModel.updateMany({
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
}

export async function keysInfo({ query }: Request, res: Response) {
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
            code: {
                $concat: ['$line.identifier', '$line.supplier.identifier', '$code']
            },
            desc: 1,
            image: 1
        }
    });

    const $and = new Array<unknown>();

    if (query?.code)
        $and.push({
            code: {
                $regex: query.code,
                $options: 'i'
            }
        });

    if (query?.desc)
        $and.push({
            desc: {
                $regex: query.desc,
                $options: 'i'
            }
        });

    if (query?.status && !isNaN(+query.status) && +query.status >= 0 && +query.status < 6)
        $and.push({ 'image.status': +query.status });

    if ($and.length > 0)
        pipeline.push({
            $match: {
                $and
            }
        });

    KeyModel.aggregate(pipeline.concat({
        $facet: {
            status: [{
                $unwind: {
                    path: '$image'
                }
            }, {
                $group: {
                    _id: '$image.status',
                    count: {
                        $sum: 1
                    }
                }
            }],
            success: [{
                $unwind: {
                    path: '$image'
                }
            }, {
                $match: {
                    'image.status': 5
                }
            }, {
                $group: {
                    _id: {
                        line: '$line',
                        code: '$code'
                    },
                    image: {
                        $first: '$image'
                    }
                }
            }, {
                $group: {
                    _id: null,
                    count: {
                        $sum: 1
                    }
                }
            }]
        }
    }, {
        $project: {
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
                    then: [{
                        count: 0
                    }],
                    else: '$success'
                }
            }
        }
    }, {
        $unwind: {
            'path': '$success'
        }
    }, {
        $project: {
            status: {
                defective: {
                    $ifNull: ['$statusdefective', 0]
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
            success: '$success.count'
        }
    })).exec((err, [data]: keyInfo[]) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });

        return res.status(200).send({ data });

    });
}

export function nextLast({ params }: Request, res: Response) {
    if (!params?.code)
        return res.status(400).send({ message: 'Client has not sent params' });

    KeyModel.aggregate([{
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
            code: {
                $concat: ['$line.identifier', '$line.supplier.identifier', '$code']
            },
            desc: 1,
            image: 1
        }
    }, {
        $sort: {
            code: 1
        }
    }, {
        $match: {
            code: {
                $gt: params.code
            }
        }
    }, {
        $limit: 1
    }]).exec((err, [data]: LeanDocument<IKey>[]) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!data)
            return res.status(404).send({ message: 'Document not found' });
        return res.status(200).send({ data });
    });
}