import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import { extname, join } from 'path';
import { config } from './config';
import { api } from './routes/api.routes';

const app = express();

//*------------------------------------------------------------------*/
// * Settings
//*------------------------------------------------------------------*/

app.set('pkg', require('../package.json'));
app.set('trust proxy', true);
app.set('env', config.ENV);
app.set('port', config.PORT);

//*------------------------------------------------------------------*/
// * Middlewares
//*------------------------------------------------------------------*/

if (app.get('env') === 'development') {
  app.use(morgan('dev'));
}
app.use(cors());
app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  multer({
    storage: multer.memoryStorage(),
    dest: join(__dirname, 'uploads'),
    fileFilter(
      { },
      { mimetype, originalname },
      cb: multer.FileFilterCallback
    ) {
      var filetypes = /jpeg|jpg/i;
      var _mimetype = filetypes.test(mimetype);
      var _extname = filetypes.test(extname(originalname));
      if (_mimetype && _extname) return cb(null, true);
      cb(new Error(`Error: File upload only supports the following filetypes - ${filetypes}`));
    },
    limits: { fileSize: 10_000_000 },
  }).single('image'),
);

//*------------------------------------------------------------------*/
// * Routes
//*------------------------------------------------------------------*/

app.get('/',
  ({ }: Request, res: Response) => res.json(
    {
      name: app.get('pkg').name,
      version: app.get('pkg').version,
      author: app.get('pkg').author,
      contributors: app.get('pkg').contributors,
      deprecated: app.get('pkg').deprecated,
    }
  )
);

app.use('/api', api);

/*------------------------------------------------------------------*/

export { app };
