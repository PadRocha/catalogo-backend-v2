import { Document, isValidObjectId, model, Model, PipelineStage, Schema } from 'mongoose';
import { findAndDeleteMany, IFindAndDeleteMany } from '../services/findAndDeleteMany';
import { LineModel } from './line';

export interface IImageFile {
    readonly idN?: number;
    readonly status?: number;
}

export interface IKey extends Document {
    readonly line: string;
    readonly code: string;
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
    totalSuccess(match: PipelineStage.Match): Promise<number>;
    countStatus(status: 0 | 1 | 2 | 3 | 4 | 5, match: PipelineStage.Match): Promise<number>;
}

const keySchema = new Schema<IKey, IKeyModel>({
    line: {
        type: Schema.Types.Mixed,
        ref: 'Line',
        required: true,
        validate: {
            validator(_id: string) {
                return new Promise<boolean>(resolve => {
                    if (!isValidObjectId(_id))
                        return resolve(false);
                    LineModel.exists({ _id }).exec((err, line) => {
                        return resolve(!err && !!line);
                    });
                });
            },
            message({ path, value }) {
                console.log(path);
                return `Line "${value}" no exists.'`;
            },
            msg: 'Invalid Line',
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
        }],
        _id: false,
        idN: true,
        validate: {
            validator(images: IImageFile[]) {
                return images.length <= 3;
            },
            message: 'Array exceeds the limit of images',
            msg: 'Image overflow',
        }
    }
}, {
    timestamps: true,
    autoIndex: true,
});

keySchema.index({ code: 1, line: 1 }, { unique: true });
keySchema.index({ _id: 1, 'image.idN': 1 }, { unique: true });

/*------------------------------------------------------------------*/

keySchema.pre<IKey & { code: string; }>('save', function (next) {
    this.code = this.code.padStart(4, '0')
    return next();
});

keySchema.statics.findAndDeleteMany = findAndDeleteMany;

keySchema.statics.totalSuccess = function (match: PipelineStage.Match) {
    return new Promise<number>(resolve => {
        this.aggregate<{ count: number }>()
            .match(match)
            .unwind('$image')
            .match({ 'image.status': 5 })
            .group({
                _id: {
                    line: '$line',
                    code: '$code'
                },
                image: {
                    $first: '$image'
                },
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

keySchema.statics.countStatus = function (status: number, match: PipelineStage.Match) {
    return new Promise<number>(resolve => {
        this.aggregate<{ count: number }>()
            .match(match)
            .unwind('$image')
            .match({ 'image.status': status })
            .group({
                _id: null,
                count: {
                    $sum: 1
                }
            })
            .exec((err, [{ count }]) => {
                if (err || !count)
                    return resolve(0);
                return resolve(count);
            });
    });
}

/*------------------------------------------------------------------*/

export const KeyModel = model<IKey, IKeyModel>('Key', keySchema);