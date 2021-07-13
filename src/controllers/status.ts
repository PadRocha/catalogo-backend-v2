import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { KeyModel } from "../models/key";

export function updateStatus({ user, params, body }: Request, res: Response) {
    if (!user?.roleIncludes(['EDIT', 'GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });

    const idN = Number(params.idN);
    if (!Types.ObjectId.isValid(params?.key) || idN < 0 || idN > 2)
        return res.status(400).send({ message: 'Client has not sent params' });

    if (!isNaN(body?.status)) {
        if (body.status < 0 || body.status > 5)
            return res.status(400).send({ message: 'Client has not sent params' });

        KeyModel.findOneAndUpdate({
            _id: params.key,
            'image.idN': idN
        }, {
            $set: {
                'image.$.status': body.status
            }
        }).exec((err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (data)
                return res.status(200).send({ data });
            else
                KeyModel.findOneAndUpdate({
                    _id: params.key,
                    'image.idN': {
                        $ne: idN
                    }
                }, {
                    $push: {
                        image: {
                            idN,
                            status: body.status
                        }
                    }
                }, {
                    new: true
                }).exec(function (err, data) {
                    if (err)
                        return res.status(409).send({ message: 'Internal error, probably error with params' });
                    if (!data)
                        return res.status(404).send({ message: 'Document not found' });
                    return res.status(200).send({ data });
                });
        });
    } else {
        KeyModel.findOneAndUpdate({
            _id: params.key
        }, {
            $pull: {
                image: {
                    idN,
                    status: {
                        $gte: 0,
                        $lte: 4
                    }
                }
            }
        }).exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });
            return res.status(200).send({ data });
        });
    }
}