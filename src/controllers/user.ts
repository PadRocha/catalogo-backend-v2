import { Request, Response } from 'express';

import { UserModel, IUser } from '../models/user';
import { hasValidRoles, intoRole, intoRoles } from '../services/roles';

export function registerUser({ body }: Request, res: Response) {
    if (!body) return res.status(400).send({ message: 'Client has not sent params' });
    if (!hasValidRoles(body?.roles) && body?.roles)
        return res.status(400).send({ message: 'Roles bundle not supported' });
    else if (body?.roles)
        body.role = intoRole(body.roles);
    new UserModel(body).save((err, userStored: IUser) => {
        if (err) return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!userStored) return res.status(204).send({ message: 'Saved and is not returning any content' });
        delete userStored.password;
        return res.status(200).send({ token: userStored.createToken() });
    });
}

export function loginUser({ body }: Request, res: Response) {
    if (!body?.password) return res.status(400).send({ message: 'Client has not sent params' });
    const { nickname, password } = <IUser>body;
    UserModel.findOne({ nickname }).exec((err, user) => {
        if (err) return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!user) return res.status(404).send({ message: 'Document not found' });
        if (!user.comparePassword(password)) return res.status(401).send({ message: 'Unauthorized' });

        return res.status(200).send({ token: user.createToken() });
    });
}

export function returnUser({ user, query }: Request, res: Response) {
    if (query?.nickname && user) {
        UserModel.findOne({ nickname: <string>query.nickname })
            .select(['-password', '-__v'])
            .exec((err, data) => {
                if (err) return res.status(409).send({ message: 'Internal error, probably error with params' });
                if (!data) return res.status(404).send({ message: 'Document not found' });
                const user = data.toObject();
                const identifier = user._id;
                const roles = intoRoles(<number>user.role);
                delete user._id;
                delete user.role;
                return res.status(200).send({
                    identifier,
                    ...user,
                    roles
                });
            });
    } else if (user) {
        const data = user.toObject();
        const identifier = data._id;
        const roles = intoRoles(<number>data.role);
        delete data._id;
        delete data.role;
        return res.status(200).send({
            identifier,
            ...data,
            roles,
        });
    } else
        return res.status(400).send({ message: 'User failed to pass authentication' });
}

export function listUser({ }: Request, res: Response) {
    UserModel.find().exec((err, user) => {
        if (err) return res.status(409).send({ message: 'Internal error, probably error with params' });
        if (!user) return res.status(404).send({ message: 'Document not found' });
        return res.status(200).send({
            data: user.map(({ _id, nickname, role }) => ({ identifier: _id, nickname, roles: intoRoles(<number>role) }))
        });
    });
}