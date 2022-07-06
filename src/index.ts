import { readFileSync } from 'fs';
import { connect, ConnectOptions } from 'mongoose';
import { join } from 'path';
import { exit } from 'process';
import { app } from './app';
import { config } from './config';
import { field, sep, title } from './services';

/**
 * #  ██████╗███████╗████████╗██████╗ ██╗ ██████╗ ██████╗    ██████╗ ██████╗  ██████╗ ██████╗ ██╗   ██╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗███████╗
 * # ██╔════╝██╔════╝╚══██╔══╝██╔══██╗██║██╔════╝██╔═══██╗   ██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██║   ██║██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║██╔════╝
 * # ██║     █████╗     ██║   ██████╔╝██║██║     ██║   ██║   ██████╔╝██████╔╝██║   ██║██║  ██║██║   ██║██║        ██║   ██║██║   ██║██╔██╗ ██║███████╗
 * # ██║     ██╔══╝     ██║   ██╔══██╗╚═╝██║     ██║   ██║   ██╔═══╝ ██╔══██╗██║   ██║██║  ██║██║   ██║██║        ██║   ██║██║   ██║██║╚██╗██║╚════██║
 * # ╚██████╗███████╗   ██║   ██║  ██║██╗╚██████╗╚██████╔╝██╗██║     ██║  ██║╚██████╔╝██████╔╝╚██████╔╝╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║███████║
 * #  ╚═════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═════╝  ╚═════╝  ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
 */

const dbOptions: ConnectOptions = {
    autoIndex: false, // Don't build indexes
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5_000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45_000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    keepAlive: true,
    keepAliveInitialDelay: 300_000,
};

(async () => {
    try {
        const simba = readFileSync(
            join(__dirname, '../assets/Simba-ASCII-78-black.ans')
        );
        console.log(simba.toString('utf8'));

        sep();
        title(`{${app.get('pkg').name}} - ${app.get('pkg').description}`);

        await connect(config.MONGO.URI, dbOptions)
            .catch(() => {
                throw new Error('No se pudo conectar a base de datos.');
            });
        field('\x1b[37mDatabase', '\x1b[33mconnected\x1b[0m');

        const server = app.listen(app.get('port'));
        field('\x1b[37mServer', `\x1b[33m${app.get('port')}\x1b[0m`);
        field('\x1b[37mStatus', `\x1b[33m${app.get('env')}\x1b[0m`);
    } catch (error) {
        if (error instanceof Error)
            console.info(`\x1b[31mError: \x1b[0m${error.message}`);
        // exit(1);
    } finally {
        sep();
    }
})();