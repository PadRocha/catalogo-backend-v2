import { Document, Types, LeanDocument, Model, model, Schema } from 'mongoose';
import { findAndDeleteMany, IFindAndDeleteMany } from '../services/findAndDeleteMany';
import { paginate, IPaginate } from '../services/paginate';
import { KeyModel } from './key';
import { SupplierModel } from './supplier';

export interface ILine extends Document {
    readonly identifier: string;
    supplier: string;
    readonly name: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    countKeys: number;
};

export interface ILineModel extends Model<ILine>, IPaginate, IFindAndDeleteMany<ILine> {
    totalKey(id: string): Promise<number>;
    findByIdentifier(identifier: string): Promise<LeanDocument<ILine> | null>;
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
        type: Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true,
        validate: {
            async validator(_id: string): Promise<boolean> {
                if (!Types.ObjectId.isValid(_id)) return false;
                return await SupplierModel
                    .exists({ _id })
                    .then(exists => exists)
                    .catch(err => { throw err });
            },
            message: ({ value }: { value: string }) => `Supplier "${value}" no exists.'`,
            reason: 'Invalid Supplier',
        },
    },
    name: {
        type: String,
        required: true,
        trim: true,
    }
}, {
    timestamps: true
});

lineSchema.index({ identifier: 1, supplier: 1 }, { unique: true });

/*------------------------------------------------------------------*/

lineSchema.statics.findAndDeleteMany = findAndDeleteMany;

lineSchema.statics.paginate = paginate;

lineSchema.statics.totalKey = async function (_id: string): Promise<number> {
    return await KeyModel
        .countDocuments()
        .where('line')
        .equals(_id)
        .then(Docs => Docs)
        .catch(err => { throw err });
}

lineSchema.statics.findByIdentifier = function (identifier: string) {
    if (!identifier || identifier?.length !== 6)
        return new Promise(resolve => resolve(undefined));

    const line = identifier.slice(0, 3);
    const supplier = identifier.slice(3, 6);
    return this.aggregate([
        {
            $lookup: {
                from: 'suppliers',
                localField: 'supplier',
                foreignField: '_id',
                as: 'supplier'
            }
        }, {
            $unwind: {
                path: '$supplier'
            }
        }, {
            $match: {
                identifier: line,
                'supplier.identifier': supplier
            }
        }, {
            $limit: 1
        }
    ]).then((line: LeanDocument<ILine>[]) => {
        return line?.pop() ?? null;
    });
}

/*------------------------------------------------------------------*/

export const LineModel = model<ILine, ILineModel>('Line', lineSchema) as ILineModel;

LineModel.createIndexes();