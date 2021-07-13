import { Router } from 'express';

import * as userController from '../controllers/user';
import * as supplierController from '../controllers/supplier';
import * as lineController from '../controllers/line';
import * as keyController from '../controllers/key';
import * as statusController from '../controllers/status';
import * as imageController from '../controllers/image';
import * as migrationController from '../controllers/migration';
import { authorized } from '../middlewares/auth';

//*------------------------------------------------------------------*/
// * Api Routes
//*------------------------------------------------------------------*/
const router = Router();

//*------------------------------------------------------------------*/
// * User Routes
//*------------------------------------------------------------------*/

router.route('/register')
    .post(authorized, userController.registerUser);

router.route('/login')
    .post(userController.loginUser);

router.route('/user')
    .get(authorized, userController.returnUser);

router.route('/user/all')
    .get(authorized, userController.listUser);

//*------------------------------------------------------------------*/
// * Api Supplier
//*------------------------------------------------------------------*/

router.route('/supplier')
    .post(authorized, supplierController.saveSupplier)
    .get(authorized, supplierController.listSupplier)
    .put(authorized, supplierController.updateSupplier)
    .delete(authorized, supplierController.deleteSupplier);

//*------------------------------------------------------------------*/
// * Api Line
//*------------------------------------------------------------------*/

router.route('/line')
    .post(authorized, lineController.saveLine)
    .get(authorized, lineController.listLine)
    .put(authorized, lineController.updateLine)
    .delete(authorized, lineController.deleteLine);

router.route('/line/:id/reset')
    .put(authorized, lineController.resetLine);

//*------------------------------------------------------------------*/
// * Api Key
//*------------------------------------------------------------------*/

router.route('/key')
    .post(authorized, keyController.saveKey)
    .get(authorized, keyController.listKey)
    .put(authorized, keyController.updateKey)
    .delete(authorized, keyController.deleteKey);

router.route('/key/reset')
    .put(authorized, keyController.resetKey);

router.route('/status/:key/:idN')
    .put(authorized, statusController.updateStatus);

router.route('/image/:key/:idN')
    .put(authorized, imageController.updateImage)
    .delete(authorized, imageController.deleteImage);

//*------------------------------------------------------------------*/
// * Migration
//*------------------------------------------------------------------*/

//! Comentados para evitar errores

// router.route('/migration/line')
//     .get(migrationController.line);

// router.route('/migration/key')
//     .get(migrationController.key);

/*------------------------------------------------------------------*/

export default router;