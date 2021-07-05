import dayjs from 'dayjs';
import { Request, Response } from 'express';
import { Secret, verify } from 'jsonwebtoken';

import { config } from '../config/config';
import { UserModel, IUser, Token } from '../models/user';

export async function authorized(req: Request, res: Response, next: (err?: Error) => void) {
  if (!req.headers.authorization?.startsWith('bearer: ') && !req.headers.authorization?.includes('"'))
    return res.status(400).send({ message: 'Client has not sent Token' });
  const token = req.headers.authorization.replace(/['"]+/g, '').split(' ').pop() as string;
  delete req.headers.authorization
  if (!token) return res.status(403).send({ message: 'The user does not have the necessary credentials for this operation' });
  try {
    var payload: Token = <Token>verify(token, <Secret>config.KEY.SECRET);
    const user: IUser | null = await UserModel.findById(payload.sub).select('-password');
    if (
      !user ||
      user.role !== payload?.role ||
      user.nickname !== payload?.nickname ||
      <number>payload?.exp <= dayjs().unix()
    ) return res.status(423).send({ message: 'Access denied' });

    delete payload.iat;
    delete payload.exp;
    req.user = user;
  } catch {
    return res.status(409).send({ message: 'Error decrypting token' });
  }
  return next();
}