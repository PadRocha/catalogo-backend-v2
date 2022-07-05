import { CallbackError, Document, Model, model, Schema } from 'mongoose';
import { Secret, sign } from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import dayjs from 'dayjs';

import { config } from '../config';
import { IRoles, roleIncludes } from '../services/roles';

export interface IUser extends Document, IRoles {
    readonly nickname: string;
    readonly sub?: string;
    password?: string;
    role?: number;
    roles?: (keyof typeof config.AUTH)[];
    comparePassword(password: string | undefined): boolean;
    createToken(): string;
}

export interface IUserModel extends Model<IUser> {
    //
}

export interface Token {
    sub: string;
    nickname: string;
    role: number;
    iat?: number;
    exp?: number;
}

const userSchema = new Schema<IUser, IUserModel>({
    nickname: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: Number,
        default: config.AUTH.READ | config.AUTH.WRITE,
        required: true,
    }
}, {
    autoIndex: true,
});

/*------------------------------------------------------------------*/

userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    const salt = await bcryptjs.genSalt(config.KEY.SALT);
    this.password = await bcryptjs.hash(<string>this.password, salt);
    return next();
});


userSchema.methods.comparePassword = function (this: IUser, password: string): boolean {
    if (!password && !password.trim() || !this.password) return false;
    return bcryptjs.compareSync(password, this.password);
};

userSchema.methods.createToken = function (this: IUser & { role: number }): string {
    const payload: Token = {
        sub: this._id,
        nickname: this.nickname,
        role: this.role,
        iat: dayjs().unix(),
        exp: dayjs().add(30, 'day').unix(),
    }

    return sign(payload, config.KEY.SECRET);
}

userSchema.methods.roleIncludes = roleIncludes;

/*------------------------------------------------------------------*/

export const UserModel = model<IUser, IUserModel>('User', userSchema);