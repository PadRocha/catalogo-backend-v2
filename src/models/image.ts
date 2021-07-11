import { Document, Schema } from 'mongoose';

export interface IImage extends Document {
    public_id?: string;
    url?: string;
}

export const ImageSchema = new Schema<IImage>({
    public_id: {
        type: String,
        required: true,
    },
    url: {
        type: String,
        required: true,
    }
});
