import { Response } from 'express';
import { get } from 'https';
import { KeyModel } from '../models/key';
import { LineModel } from '../models/line';
import { SupplierModel } from '../models/supplier';

export function line({ }, res: Response) {
    get('https://catalogo-photos.herokuapp.com/api/line', {
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'bearer: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZTZiZWVmMWNmNjI3OTVkZTBlMWU3OTEiLCJuaWNrbmFtZSI6InBhZHJvY2hhIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNjI2MTk0Mzg4LCJleHAiOjE2Mjg3ODYzODh9.gy_wsVhCJfjBvhfaP778lOUsz2fv99MeMceljoTJs2g',
        },
    }, resp => {
        let response = '';
        let dataParsed: {
            data: {
                identifier: string;
                supplier: string | null | any;
                name: string;
                started?: Date;
                __v?: any;
            }[]
        };

        // A chunk of data has been received.
        resp.on('data', (chunk) => {
            response += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', async () => {
            if (!response)
                return res.status(404).send({ message: 'Document not found' });

            dataParsed = JSON.parse(response);
            const lines = dataParsed.data;
            await Promise.all(
                lines.map(async line => {
                    const supplier = line.identifier.slice(3, 6);
                    line.identifier = line.identifier.slice(0, 3);
                    line.supplier = await SupplierModel.findByIdentifier(supplier).catch(() => {
                        return res.status(400).send({ message: 'Client has not sent params' });
                    });
                    delete line.started;
                    delete line.__v;
                    return await new LineModel(line).save((err, data) => {
                        console.log("🚀 ~ file: migration.ts ~ line 46 ~ returnawaitnewLineModel ~ data", data)
                        console.log("🚀 ~ file: migration.ts ~ line 46 ~ returnawaitnewLineModel ~ err", err)
                    });
                })
            );

            return res.status(200).send({ lines });
        });

    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

export function key({ }, res: Response) {
    get('https://catalogo-photos.herokuapp.com/api/key', {
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'bearer: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZTZiZWVmMWNmNjI3OTVkZTBlMWU3OTEiLCJuaWNrbmFtZSI6InBhZHJvY2hhIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNjI2MTk0Mzg4LCJleHAiOjE2Mjg3ODYzODh9.gy_wsVhCJfjBvhfaP778lOUsz2fv99MeMceljoTJs2g',
        },
    }, resp => {
        let response = '';
        let dataParsed: {
            data: {
                code: string;
                line?: string | any;
                desc: string;
                image: {
                    publicId?: string;
                    img?: string;
                    public_id?: string;
                    url?: string;
                    status: number;
                    idN: number;
                }[];
                createdAt?: Date;
                __v?: any;
                id?: string;
            }[]
        };

        // A chunk of data has been received.
        resp.on('data', (chunk) => {
            response += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', async () => {
            if (!response)
                return res.status(404).send({ message: 'Document not found' });

            dataParsed = JSON.parse(response);
            const keys = dataParsed.data;
            await Promise.all(
                keys.map(async key => {
                    key.line = await LineModel.findByIdentifier(<string>key.line).catch(() => {
                        return res.status(400).send({ message: 'Client has not sent params' });
                    });
                    key.image = key.image.map(image => {
                        image.public_id = image.publicId;
                        image.url = image.img;
                        image.idN = image.idN - 1;
                        delete image.publicId;
                        delete image.img;
                        return image;
                    });
                    delete key.createdAt;
                    delete key.__v;
                    delete key.id;
                    return await new KeyModel(key).save((err, data) => {
                        console.log("🚀 ~ file: migration.ts ~ line 46 ~ returnawaitnewLineModel ~ data", data)
                        console.log("🚀 ~ file: migration.ts ~ line 46 ~ returnawaitnewLineModel ~ err", err)
                    });
                })
            )

            return res.status(200).send({ keys });
        });

    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}