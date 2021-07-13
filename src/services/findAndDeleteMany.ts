import { CallbackError, FilterQuery, Model } from "mongoose";

export interface IFindAndDeleteMany<T> extends Model<T> {
    findAndDeleteMany(filter: FilterQuery<T>, callback?: (err: CallbackError, res: T[] | null) => void): Promise<T[]>;
}

export function findAndDeleteMany(this: Model<any>, filter: FilterQuery<any>, callback: (err: CallbackError, res: any[] | null) => void) {
    const find = this.find();
    find.setQuery(filter);
    return new Promise((resolve, reject) => {
        find.exec((findError, findData) => {
            if (findError) {
                if (callback)
                    callback(findError, null);

                reject(findError)
            }

            if (!findData) {
                if (callback)
                    callback(findError, findData);

                resolve(findData);
            }

            this.deleteMany(filter).exec(deleteError => {
                if (deleteError) {
                    if (callback)
                        callback(deleteError, null);

                    reject(deleteError);
                } else {
                    if (callback)
                        callback(deleteError, findData);

                    resolve(findData);
                }
            });
        });
    });
}