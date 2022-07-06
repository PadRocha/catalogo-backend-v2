import { Request, Response } from "express";
import { existsSync, unlinkSync } from "fs";
import { isValidObjectId, LeanDocument, Types } from "mongoose";
import { resolve } from "path";
import { KeyModel } from "../models/key";
import { LineModel } from "../models/line";
import { ISupplier, SupplierModel } from "../models/supplier";

export async function saveSupplier(
    { user, body }: Omit<Request, 'body'> & {
        body: LeanDocument<ISupplier>,
    },
    res: Response
) {
    if (!user?.roleIncludes('GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!body)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const data = await new SupplierModel(body).save();
        if (!data)
            return res.status(204).send({
                message: 'Saved and is not returning any content'
            });
        return res.status(200).send({ data });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function listSupplier({ user }: Request, res: Response) {
    if (!user?.roleIncludes('READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    try {
        const data = await SupplierModel.find().lean();
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

export async function updateSupplier(
    {
        user,
        body,
        query: { id: _id },
    }: Omit<Request, 'body'> & {
        body: LeanDocument<ISupplier>,
        query: {
            id?: string;
        }
    },
    res: Response
) {
    if (!user?.roleIncludes('EDIT', 'GRANT', 'ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!isValidObjectId(_id) || !body)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const data = await SupplierModel.findOneAndUpdate({ _id }, body).lean();
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

export async function deleteSupplier(
    {
        user,
        query: { id: _id, force },
    }: Request & {
        query: {
            id?: string;
            force?: 'delete';
        }
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
        const data = await SupplierModel.findOneAndDelete({ _id }).lean();
        if (!data)
            return res.status(404).send({
                message: 'Document not found'
            });
        if (force === 'delete') {
            const lines = await LineModel.findAndDeleteMany({ supplier: data._id });
            for await (const { _id: line, identifier } of lines) {
                const keys = await KeyModel.findAndDeleteMany({ line });
                //TODO: Revisar si espera a todas estas acciones
                for (const { code, image } of keys) {
                    for (const { idN, status } of image) {
                        if (status !== 5)
                            continue;
                        const line = identifier + data.identifier.trim();
                        const image = code + ' ' + idN + '.jpg';
                        const file = resolve(
                            __dirname,
                            "../../public",
                            line,
                            image,
                        );
                        if (!existsSync(file))
                            continue;
                        unlinkSync(file);
                    }
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