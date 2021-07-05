import { CallbackError, Document, Model, model, Schema } from 'mongoose';
import { Secret, sign } from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import dayjs from 'dayjs';

import { config } from '../config/config';
import { roleIncludes } from '../services/roles';

export interface IUser extends Document {
    readonly nickname: string;
    readonly sub?: string;
    password?: string;
    role?: number;
    roles?: string[];
    comparePassword(password: string | undefined): boolean;
    createToken(): string;
    roleIncludes(roles: 'READ' | 'WRITE' | 'EDIT' | 'GRANT' | 'ADMIN' | ('READ' | 'WRITE' | 'EDIT' | 'GRANT' | 'ADMIN')[]): boolean;
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
});

/*------------------------------------------------------------------*/

userSchema.pre('save', async function (next: (err?: CallbackError) => void) {
    if (!this.isModified('password')) return next();
    const salt = await bcryptjs.genSalt(config.KEY.SALT);
    this.password = await bcryptjs.hash(<string>this.password, salt);
    return next();
});


userSchema.methods.comparePassword = function (password: string): boolean {
    if (!password && !password.trim()) return false;
    return bcryptjs.compareSync(password, <string>this.password);
};

userSchema.methods.createToken = function (): string {
    const payload: Token = {
        sub: this._id,
        nickname: this.nickname,
        role: <number>this.role,
        iat: dayjs().unix(),
        exp: dayjs().add(30, 'day').unix(),
    }

    return sign(payload, <Secret>config.KEY.SECRET);
}

userSchema.methods.roleIncludes = roleIncludes;

/*------------------------------------------------------------------*/

export const UserModel = model<IUser, IUserModel>('User', userSchema);

try {
    UserModel.createIndexes();
} catch {
    //
}