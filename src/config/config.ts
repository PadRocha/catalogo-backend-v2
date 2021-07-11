import dotenv from 'dotenv';

dotenv.config();

export const config = {
    ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 5885,
    KEY: {
        SECRET: process.env.SECRET_KEY || '//password',
        SALT: Number(process.env.SALT) || 11,
    },
    MONGO: {
        URI: process.env.MONGO_URI || 'mongodb://localhost/database',
        USER: process.env.MONGO_USER,
        PASSWORD: process.env.MONGO_PASSWORD,
    },
    AUTH: {
        READ: Number(process.env.AUTH_READ) || 2,
        WRITE: Number(process.env.AUTH_WRITE) || 4,
        EDIT: Number(process.env.AUTH_EDIT) || 8,
        GRANT: Number(process.env.AUTH_GRANT) || 16,
        ADMIN: Number(process.env.AUTH_ADMIN) || 32,
    },
    CLOUDINARY: {
        ENV_VAR: process.env.CLOUDINARY_ENV_VAR,
        NAME: process.env.CLOUDINARY_NAME,
        KEY: process.env.CLOUDINARY_KEY,
        SECRET: process.env.CLOUDINARY_SECRET,
    },
    LIMIT: {
        LINE: 5,
        KEY: 5
    }
} as const;