import { Document, LeanDocument, Model, model, Schema, Types } from 'mongoose';

export interface ISupplier extends Document {
    readonly identifier: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export interface ISupplierModel extends Model<ISupplier> {
    findByIdentifier(identifier: string): Promise<Types.ObjectId | null>;
}

const supplierSchema = new Schema<ISupplier, ISupplierModel>({
    identifier: {
        type: String,
        unique: true,
        minlength: 2,
        maxlength: 3,
        uppercase: true
    },
}, {
    timestamps: true,
    autoIndex: true,
});

/*------------------------------------------------------------------*/

supplierSchema.pre<ISupplier & { identifier: string; }>('save', function (next) {
    this.identifier = this.identifier.padEnd(3, ' ');
    return next();
});

supplierSchema.statics.findByIdentifier = function (identifier: string) {
    return new Promise<Types.ObjectId | null>(resolve => {
        if (!/^[a-z0-9]{3}$/i.test(identifier))
            return resolve(null);
        this.aggregate<LeanDocument<ISupplier>>()
            .match({
                identifier: identifier.toUpperCase()
            })
            .project({ _id: 1 })
            .exec((err, [{ _id }]) => {
                if (err || !_id)
                    return resolve(null)
                return resolve(new Types.ObjectId(_id));
            });
    });
}

/*------------------------------------------------------------------*/

export const SupplierModel = model<ISupplier, ISupplierModel>('Supplier', supplierSchema);