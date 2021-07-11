import { Document, isValidObjectId, Model, model, Schema } from 'mongoose';
import { countDocs, ICountDocs } from '../services/countDocs';
import { paginate, IPaginate } from '../services/paginate';
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

export interface IKeyModel extends Model<IKey>, IPaginate, ICountDocs {
    infoStatus(pipeline: unknown[]): Promise<{
        status: {
            white: number;
            gray: number;
            brown: number;
            blue: number;
            purple: number;
            green: number;
        };
        percentage: number;
    }>;
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
                if (!isValidObjectId(_id)) return false;
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

keySchema.pre<IKey>('save', function (next: Function) {
    for (let i = 0; i < (4 - this.code.length); i++)
        this.code = '0' + this.code;
    return next();
});

keySchema.statics.countDocs = countDocs;

keySchema.statics.paginate = paginate;

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

keySchema.statics.infoStatus = async function (pipeline: unknown[]) {
    const total = await this.countDocs(pipeline);
    const success = await this.totalSuccess(pipeline);
    return {
        status: {
            white: await this.countStatus(pipeline, 0),
            gray: await this.countStatus(pipeline, 1),
            brown: await this.countStatus(pipeline, 2),
            blue: await this.countStatus(pipeline, 3),
            purple: await this.countStatus(pipeline, 4),
            green: await this.countStatus(pipeline, 5)
        },
        percentage: 100 * success / total
    };
}

/*------------------------------------------------------------------*/

export const KeyModel = model<IKey, IKeyModel>('Key', keySchema) as IKeyModel;

KeyModel.createIndexes();