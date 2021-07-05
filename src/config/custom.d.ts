import { IUser } from '../models/user'

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

// interface PaginateResult<T> {
    // nextPage?: number | boolean | T[] | undefined; //TODO: Revisar error paginate
    // prevPage?: number | boolean | T[] | undefined; //TODO: Revisar error paginate
    // [customLabel: string]: T[] | number | boolean | undefined | object; //* Added object
// }