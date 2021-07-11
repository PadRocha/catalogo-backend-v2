import mongoose, { ConnectionOptions } from 'mongoose';

import { config } from './config/config';
import { dump, field, sep } from './config/fmt';

const dbOptions: ConnectionOptions = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
    autoIndex: true,
};

(async () => {
    await mongoose.connect(config.MONGO.URI, dbOptions).then(value => {
        field('\x1b[37mDB', '\x1b[33mconnected\x1b[0m');
        sep();
    }).catch(err => {
        if (err) dump(err, '\x1b[37mDB(\x1b[31merror\x1b[0m): ');
        sep();
    });
})();