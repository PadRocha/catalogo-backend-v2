import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { SupplierModel } from '../models/supplier';

export function saveSupplier({ body }: Request, res: Response) {
    if (!body)
        return res.status(400).send({ message: 'Client has not sent params' });
    new SupplierModel(body).save((err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!data) return res.status(204).send({ message: 'Saved and is not returning any content' });
        return res.status(200).send({ data });
    });
}

export function listSupplier({ }: Request, res: Response) {
    SupplierModel.find().exec((err, data) => {
        if (err)
            return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!data)
            return res.status(404).send({ message: 'Document not found' });
        return res.status(200).send({ data });
    });
}

export function updateSupplier({ query, body }: Request, res: Response) {
    if (!isValidObjectId(query?.id) || !body)
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

export function deleteSupplier({ query, body }: Request, res: Response) {
    if (!isValidObjectId(query?.id))
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