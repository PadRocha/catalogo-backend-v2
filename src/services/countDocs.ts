import { Model } from "mongoose";

export interface ICountDocs {
    countDocs(pipeline: unknown[]): Promise<number>;
}

export function countDocs(this: Model<any>, pipeline: unknown[]) {
    return this.aggregate(pipeline.concat({
        $group: {
            _id: null,
            count: {
                $sum: 1
            }
        }
    })).then((res: { count: number }[]) => res?.pop()?.count ?? 0);
}