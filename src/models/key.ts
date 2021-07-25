import { Document, Types, Model, model, Schema, CallbackError } from 'mongoose';
import { findAndDeleteMany, IFindAndDeleteMany } from '../services/findAndDeleteMany';
import { IImage } from './image';
import { LineModel } from './line';

export interface IImageFile extends IImage {
    idN: number;
    status: number;
}

export interface IKey extends Document {
    readonly line: string;
    code: string;
    readonly desc: string;
    readonly image: IImageFile[];
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface keyInfo {
    readonly status?: {
        readonly defective?: number;
        readonly found?: number;
        readonly photographed?: number;
        readonly prepared?: number;
        readonly edited?: number;
        readonly saved?: number;
    };
    readonly success?: number;
}

export interface IKeyModel extends Model<IKey>, IFindAndDeleteMany<IKey> {
    totalSuccess(pipeline: unknown[]): Promise<number>;
    countStatus(pipeline: unknown[], status: 0 | 1 | 2 | 3 | 4 | 5): Promise<number>;
}

const keySchema = new Schema<IKey, IKeyModel>({
    line: {
        type: Schema.Types.ObjectId,
        ref: 'Line',
        required: true,
        validate: {
            async validator(_id: string): Promise<boolean> {
                if (!Types.ObjectId.isValid(_id)) return false;
                return await LineModel
                    .exists({ _id })
                    .then(exists => exists)
                    .catch(err => { throw err });
            },
            message: ({ value }: { value: string }) => `Line "${value}" no exists.'`,
            reason: 'Invalid Line',
        },
    },
    code: {
        type: String,
        trim: true,
        maxlength: 4,
        uppercase: true,
        required: true
    },
    desc: {
        type: String,
        trim: true,
        required: true
    },
    image: {
        type: [{
            idN: {
                type: Number,
                required: true
            },
            status: {
                type: Number,
                min: 0,
                max: 5,
                default: 0,
                required: true
            },
            public_id: {
                type: String,
                default: null
            },
            url: {
                type: String,
                default: null
            }
        }],
        _id: false,
        idN: true,
        validate: {
            validator(images: IImageFile[]) {
                return images.length <= 3;
            },
            message: 'Array exceeds the limit of images',
            reason: 'Image overflow',
        }
    }
}, {
    timestamps: true
});

keySchema.index({ code: 1, line: 1 }, { unique: true });
keySchema.index({ _id: 1, 'image.idN': 1 }, { unique: true });

/*------------------------------------------------------------------*/

keySchema.pre<IKey>('save', function (next: (err?: CallbackError) => void) {
    const interaction = (4 - this.code.toString().length);
    for (let i = 0; i < interaction; i++) {
        this.code = '0' + this.code;
    }

    return next();
});

keySchema.statics.findAndDeleteMany = findAndDeleteMany;

keySchema.statics.totalSuccess = function (pipeline: unknown[]) {
    return this.aggregate(pipeline.concat({
        $unwind: {
            path: '$image'
        }
    }, {
        $match: {
            'image.status': 5
        }
    }, {
        $group: {
            _id: {
                line: '$line',
                code: '$code'
            },
            image: {
                $first: '$image'
            }
        }
    }, {
        $group: {
            _id: null,
            count: {
                $sum: 1
            }
        }
    })).then((res: { count: number }[]) => res?.pop()?.count ?? 0);
}

keySchema.statics.countStatus = function (pipeline: unknown[], status: number) {
    return this.aggregate(pipeline.concat({
        $unwind: {
            path: '$image'
        }
    }, {
        $match: {
            'image.status': status
        }
    }, {
        $group: {
            _id: null,
            count: {
                $sum: 1
            }
        }
    })).then((res: { count: number }[]) => res?.pop()?.count ?? 0);
}

/*------------------------------------------------------------------*/

export const KeyModel = model<IKey, IKeyModel>('Key', keySchema) as IKeyModel;

KeyModel.createIndexes();