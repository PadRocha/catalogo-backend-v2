import { Request, Response } from 'express';
import { LeanDocument } from 'mongoose';
import { IUser, UserModel } from '../models/user';
import { hasValidRoles, intoRole, intoRoles } from '../services/roles';

export async function registerUser(
    { user, body }: Omit<Request, 'body'> & {
        body: LeanDocument<IUser>;
    },
    res: Response
) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    if (!body)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    if (!hasValidRoles(body?.roles))
        return res.status(400).send({
            message: 'Roles bundle not supported'
        });
    else if (body?.roles)
        body.role = intoRole(body.roles);
    try {
        const user = await new UserModel(body).save();
        if (!user)
            return res.status(204).send({
                message: 'Saved and is not returning any content'
            });
        delete user.password;
        return res.status(200).send({
            token: user.createToken()
        });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function loginUser(
    {
        body: { nickname, password }
    }: Omit<Request, 'body'> & {
        body: {
            password?: string;
            nickname?: string;
        };
    },
    res: Response
) {
    if (!nickname || !password)
        return res.status(400).send({ message: 'Client has not sent params' });
    try {
        const user = await UserModel.findOne({ nickname });
        if (!user)
            return res.status(404).send({
                message: 'Document not found'
            });
        if (!user.comparePassword(password))
            return res.status(401).send({
                message: 'Unauthorized'
            });
        return res.status(200).send({
            token: user.createToken()
        });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function returnUser(
    {
        user,
        query: { nickname: _nickname }
    }: Request & {
        query: {
            nickname?: string;
        };
    },
    res: Response
) {
    if (user) {
        const { _id: identifier, nickname, role } = user.toObject<IUser>();
        const roles = intoRoles(role);
        return res.status(200).send({ identifier, nickname, roles });
    }
    if (!_nickname)
        return res.status(400).send({
            message: 'Client has not sent params'
        });
    try {
        const data = await UserModel.findOne({ nickname: _nickname })
            .select(['-password', '-__v'])
            .lean();
        if (!data)
            return res.status(404).send({
                message: 'Document not found'
            });
        const { _id: identifier, nickname, role } = data;
        const roles = intoRoles(role);
        return res.status(200).send({ identifier, nickname, roles, });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}

export async function listUser({ user }: Request, res: Response) {
    if (!user?.roleIncludes('ADMIN'))
        return res.status(423).send({
            message: 'Access denied'
        });
    try {
        const data = await UserModel.find();
        if (!data)
            return res.status(404).send({
                message: 'Document not found'
            });

        return res.status(200).send({
            data: data.map(({ _id: identifier, nickname, role }) => ({
                identifier,
                nickname,
                roles: intoRoles(role)
            }))
        });
    } catch {
        return res.status(409).send({
            message: 'Internal error, probably error with params'
        });
    }
}