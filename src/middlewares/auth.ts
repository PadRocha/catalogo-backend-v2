import dayjs from 'dayjs';
import { Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { config } from '../config';
import { IUser, Token, UserModel } from '../models/user';

export async function authorized(req: Request, res: Response, next: (err?: Error) => void) {
  if (!req.headers.authorization?.startsWith('Bearer'))
    return res.status(400).send({ message: 'Client has not sent Token' });
  const token = req.headers.authorization.split(' ').pop();
  delete req.headers.authorization
  if (!token)
    return res.status(403).send({ message: 'The user does not have the necessary credentials for this operation' });
  try {
    var payload: Token = <Token>verify(token, config.KEY.SECRET);
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
  } finally {
    return next();
  }
}