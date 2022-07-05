import { CallbackError, FilterQuery, LeanDocument, Model } from "mongoose";

export interface IFindAndDeleteMany<T> extends Model<T> {
    findAndDeleteMany(filter: FilterQuery<T>): Promise<LeanDocument<T>[]>;
    findAndDeleteMany(filter: FilterQuery<T>, callback?: (err: CallbackError, res: LeanDocument<T>[] | null) => void): void;
}

export function findAndDeleteMany(
    this: Model<any>,
    filter: FilterQuery<any>,
    callback: (err: CallbackError, res: any[] | null) => void
) {
    const find = this.find();
    find.setQuery(filter);
    return new Promise((resolve, reject) => {
        find.lean().exec((findError, findData) => {
            if (findError) {
                if (callback)
                    return callback(findError, null);

                return reject(findError)
            }

            if (!findData) {
                if (callback)
                    return callback(findError, findData);

                return resolve(findData);
            }

            this.deleteMany(filter).exec(deleteError => {
                if (deleteError) {
                    if (callback)
                        return callback(deleteError, null);

                    return reject(deleteError);
                } else {
                    if (callback)
                        return callback(deleteError, findData);

                    return resolve(findData);
                }
            });
        });
    });
}