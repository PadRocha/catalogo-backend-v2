import { Document, LeanDocument, Model, model, Schema } from 'mongoose';

export interface ISupplier extends Document {
    readonly identifier: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export interface ISupplierModel extends Model<ISupplier> {
    findByIdentifier(identifier: string): Promise<LeanDocument<ISupplier> | undefined>;
}

const supplierSchema = new Schema<ISupplier, ISupplierModel>({
    identifier: {
        type: String,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 3,
        uppercase: true
    },
}, {
    timestamps: true
});

/*------------------------------------------------------------------*/


supplierSchema.statics.findByIdentifier = function (identifier: string) {
    return this.aggregate([
        {
            $match: {
                identifier
            }
        }, {
            $limit: 1
        }
    ]).then((supplier: LeanDocument<ISupplier>[]) => {
        return supplier?.pop();
    });
}

/*------------------------------------------------------------------*/

export const SupplierModel = model<ISupplier, ISupplierModel>('Supplier', supplierSchema) as ISupplierModel;

SupplierModel.createIndexes();