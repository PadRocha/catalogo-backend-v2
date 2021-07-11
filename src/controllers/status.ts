import { Request, Response } from 'express';
import { KeyModel } from "../models/key";

export function updateStatus({ params, body }: Request, res: Response) {
    const idN = Number(params.idN);
    const status = Number(body.status);
    if (!params?.key || idN > 2 || status > 4)
        return res.status(400).send({ message: 'Client has not sent params' });
    KeyModel.findOneAndUpdate({
        _id: params.key,
        'image.idN': idN
    }, {
        $set: {
            'image.$.status': status
        }
    }).exec((err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (data)
            return res.status(200).send({ data });
        else {
            KeyModel.findOneAndUpdate({
                _id: params.key,
                'image.idN': {
                    $ne: idN
                }
            }, {
                $push: {
                    image: {
                        idN,
                        status
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
        }
    });
}

export function deleteStatus({ params }: Request, res: Response) {
    const idN = Number(params?.idN);
    if (!params?.key || idN > 2)
        return res.status(400).send({ message: 'Client has not sent params' });
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