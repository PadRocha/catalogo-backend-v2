import { Model, Query } from "mongoose";

export interface paginateMetadata {
    totalDocs: number;
    limit: number;
    page: number;
    nextPage: number | null;
    prevPage: number | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    totalPages: number;
}

export interface IPaginate {
    paginate(
        limit: number,
        page: number,
        pipeline?: unknown[] | Query<any, any, any>
    ): Promise<paginateMetadata>;
}

export async function paginate(
    this: Model<any>,
    limit: number,
    page: number,
    pipeline: unknown[] | null | Query<any, any, any> = null
) {
    const count = Array.isArray(pipeline)
        ? this.aggregate(pipeline.concat({
            $group: {
                _id: null,
                count: {
                    $sum: 1
                }
            }
        })).then((res: { count: number }[]) => res?.pop()?.count ?? 0)
        : !!pipeline
            ? this.countDocuments().merge(pipeline)
            : this.countDocuments();


    const totalDocs = await count;
    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = totalPages > page;
    const hasPrevPage = page > 1;
    return {
        totalDocs,
        limit,
        page,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
        hasNextPage,
        hasPrevPage,
        totalPages
    };
}