import { Document, isValidObjectId, LeanDocument, Model, model, Schema, Types } from 'mongoose';
import { findAndDeleteMany, IFindAndDeleteMany } from '../services/findAndDeleteMany';
import { KeyModel } from './key';
import { SupplierModel } from './supplier';

export interface ILine extends Document {
    readonly identifier: string;
    readonly supplier: string;
    readonly name: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly countKeys: number;
};

export interface ILineModel extends Model<ILine>, IFindAndDeleteMany<ILine> {
    /**
     * Retorna el total de claves que poseen el _id de la línea
     * @param id string
     * @returns number
     * @example
     * ```js
     * LineModel.totalKey('5f6d2656e8900400040e1f9e');
     * ```
     * @deprecated Ya no se utiliza más, se implementó otra ruta para extraer esta información
     */
    totalKey(id: string): Promise<number>;
    /**
     * Retorna el _id de la línea dependiendo de su ID
     * @param identifier string
     * @returns Types.ObjectId
     * @example
     * ```js
     * LineModel.findByIdentifier('GRA');
     * ```
     */
    findByIdentifier(identifier: string): Promise<Types.ObjectId | null>;
}

const lineSchema = new Schema<ILine, ILineModel>({
    identifier: {
        type: String,
        trim: true,
        minlength: 3,
        maxlength: 3,
        uppercase: true
    },
    supplier: {
        type: Schema.Types.Mixed,
        ref: 'Supplier',
        required: true,
        validate: {
            validator(_id: string) {
                return new Promise<boolean>(resolve => {
                    if (!isValidObjectId(_id))
                        return resolve(false);
                    SupplierModel.exists({ _id }).exec((err, line) => {
                        return resolve(!err && !!line);
                    });
                });
            },
            message: ({ value }: { value: string }) => `Supplier "${value}" no exists.'`,
            msg: 'Invalid Supplier',
        },
    },
    name: {
        type: String,
        required: true,
        trim: true,
    }
}, {
    timestamps: true,
    autoIndex: true,
});

lineSchema.index({ identifier: 1, supplier: 1 }, { unique: true });

/*------------------------------------------------------------------*/

lineSchema.statics.findAndDeleteMany = findAndDeleteMany;

lineSchema.statics.totalKey = async function (line: string): Promise<number> {
    return new Promise<number>(resolve => {
        KeyModel.aggregate<{ count: number }>()
            .match({
                line: new Types.ObjectId(line)
            })
            .group({
                _id: null,
                count: {
                    $sum: 1
                },
            })
            .exec((err, [{ count }]) => {
                if (err || !count)
                    return resolve(0);
                return resolve(count);
            });
    });
}

lineSchema.statics.findByIdentifier = function (identifier: string) {
    return new Promise<Types.ObjectId | null>(resolve => {
        if (!/^[a-z0-9]{5,6}$/i.test(identifier))
            return resolve(null);
        this.aggregate<LeanDocument<ILine>>()
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
                }
            })
            .match({
                identifier: identifier.toUpperCase()
            })
            .project({ _id: 1 })
            .exec((err, [{ _id }]) => {
                if (err || !_id)
                    return resolve(null)
                return resolve(new Types.ObjectId(_id));
            })
    });
}

/*------------------------------------------------------------------*/

export const LineModel = model<ILine, ILineModel>('Line', lineSchema);