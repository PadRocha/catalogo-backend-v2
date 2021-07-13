import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { v2 } from 'cloudinary';
import { KeyModel } from '../models/key';
import { LineModel } from '../models/line';
import { SupplierModel } from '../models/supplier';
import { config } from '../config/config';

v2.config({
    cloud_name: config.CLOUDINARY.NAME,
    api_key: config.CLOUDINARY.KEY,
    api_secret: config.CLOUDINARY.SECRET,
});

export function saveSupplier({ user, body }: Request, res: Response) {
    if (!user?.roleIncludes(['GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (!body)
        return res.status(400).send({ message: 'Client has not sent params' });
    new SupplierModel(body).save((err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!data) return res.status(204).send({ message: 'Saved and is not returning any content' });
        return res.status(200).send({ data });
    });
}

export function listSupplier({ user }: Request, res: Response) {
    if (!user?.roleIncludes(['READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    SupplierModel.find().exec((err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!data)
            return res.status(404).send({ message: 'Document not found' });
        return res.status(200).send({ data });
    });
}

export function updateSupplier({ user, query, body }: Request, res: Response) {
    if (!user?.roleIncludes(['EDIT', 'GRANT', 'ADMIN']))
        return res.status(423).send({ message: 'Access denied' });
    if (!Types.ObjectId.isValid(<string>query?.id) || !body)
        return res.status(400).send({ message: 'Client has not sent params' });
    SupplierModel.findOneAndUpdate({ _id: <string>query.id }, body)
        .exec((err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });
            return res.status(200).send({ data });
        });
}

export function deleteSupplier({ user, query }: Request, res: Response) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({ message: 'Access denied' });
    if (!Types.ObjectId.isValid(<string>query?.id))
        return res.status(400).send({ message: 'Client has not sent params' });
    SupplierModel.findOneAndDelete({ _id: <string>query.id })
        .exec(async (err, data) => {
            if (err)
                return res.status(409).send({ message: 'Internal error, probably error with params' });
            if (!data)
                return res.status(404).send({ message: 'Document not found' });
            if (query?.force === 'delete' && await LineModel.exists({ supplier: data._id })) {
                try {
                    const lines = await LineModel.findAndDeleteMany({ supplier: data._id });
                    await Promise.all(
                        lines.map(async line => {
                            const keys = await KeyModel.findAndDeleteMany({ line: line._id });
                            await Promise.all(
                                keys.map(async k => await Promise.all(
                                    k.image
                                        .filter(i => i.public_id)
                                        .map(async i => {
                                            return await v2.uploader.destroy(<string>i.public_id)
                                        })
                                ))
                            );
                        })
                    );
                } catch (error) {
                    return res.status(409).send({ message: 'Batch removal process has failed' });
                }
            }
            return res.status(200).send({ data });
        });
}