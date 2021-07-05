import { Router } from 'express';

import * as userController from '../controllers/user';
import { authorized } from '../middlewares/auth';

//*------------------------------------------------------------------*/
// * Api Routes
//*------------------------------------------------------------------*/
const router = Router();

//*------------------------------------------------------------------*/
// * User Routes
//*------------------------------------------------------------------*/

router.route('/register')
    .post(userController.registerUser);

router.route('/login')
    .post(userController.loginUser);

router.route('/user')
    .get(authorized, userController.returnUser);

router.route('/user/list')
    .get(userController.listUser);

/*------------------------------------------------------------------*/

export default router;

//?------------------------------------------------------------------*/
// ? Api Docs Definitions
//?------------------------------------------------------------------*/

/**
 * @apiDefine admin Admin access only
 * This function is restricted for administrators.
*/

/**
 * @apiDefine user User access only
 * This function is restricted for logged in users.
*/

/**
 * @apiDefine header Header Authorization
 * @apiHeader {String} Authorization Users unique access-key.
 *
 * @apiHeaderExample {json} Request-E:
 *      {
 *           "Authorization": "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCI8.eyJzdWIiOiI1ZTZiZWVmMWNmNjI3OTVkZTBlMWU3OTEiLCJuaWNrbmFtZSI6InBhZHJvY2hhIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTg4MzkxNTUxLCJleHAiOjE1OTA5ODM1NTF9.kXECNDTfHt6yMdpR__InB6wu0Z8FKs8083mBnyVVaWg"
 *      }
 */

//*------------------------------------------------------------------*/
// * Define Params
//*------------------------------------------------------------------*/

/**
 * @apiDefine page
 * @apiParam (params) {number} page Number of page.
 */

/**
 * @apiDefine regex
 * @apiParam (params) {string} id Regular expression that matches the start.
 */

//*------------------------------------------------------------------*/
// * Body Params
//*------------------------------------------------------------------*/



 //*------------------------------------------------------------------*/
 // * Define Sucess
 //*------------------------------------------------------------------*/

/**
 * @apiDefine SuccessToken
 * @apiSuccess {json} token User Token identificaction
 *
 * @apiSuccessExample  {json} Success-R:
 *      HTTP/1.1 200 OK
 *      {
 *           "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCI8.eyJzdWIiOiI1ZTZiZWVmMWNmNjI3OTVkZTBlMWU3OTEiLCJuaWNrbmFtZSI6InBhZHJvY2hhIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTg4MzkxNTUxLCJleHAiOjE1OTA5ODM1NTF9.kXECNDTfHt6yMdpR__InB6wu0Z8FKs8083mBnyVVaWg"
 *      }
 */

//*------------------------------------------------------------------*/
// * Define Errors
//*------------------------------------------------------------------*/

/**
 * @apiDefine HeaderErrors
 * @apiError Passport[P] Request Header does not contain token
 *
 * @apiErrorExample {json} P-R:
 *      HTTP/1.1 400 The server cannot or will not process the request due to an apparent client error.
 *      {
 *          "message": "Client has not sent Token"
 *      }
 *
 * @apiError Credencials[CR] Passport does not contain credentials
 *
 * @apiErrorExample {json} CR-R:
 *      HTTP/1.1 403 The request contained valid data and was understood by the server, but the server is refusing action.
 *      {
 *          "message": "The user does not have the necessary credentials for this operation"
 *      }
 *
 * @apiError Access[A] Passport of user is invalid
 *
 * @apiErrorExample {json} A-R:
 *      HTTP/1.1 423 The resource that is being accessed is locked.
 *      {
 *          "message": "Access denied"
 *      }
 *
 * @apiError Decryp[D] Decrypting Failed
 *
 * @apiErrorExample {json} D-R:
 *      HTTP/1.1 409 The decryption process was unable to process the token.
 *      {
 *          "message": "Error decrypting token"
 *      }
 */

/**
 * @apiDefine BadRequest
 * @apiError BadRequest[BR] Request not contains data
 *
 * @apiErrorExample {json} BR-R:
 *      HTTP/1.1 400 The server cannot or will not process the request due to an apparent client error.
 *      {
 *          "message": "Client has not sent params"
 *      }
 */

/**
 * @apiDefine Conflict
 * @apiError Concflict[C] An internal error ocurred
 *
 * @apiErrorExample {json} C-R:
 *      HTTP/1.1 409 Indicates that the request could not be processed because of conflict in the current state of the resource
 *      {
 *          "message": "Internal error, probably error with params"
 *      }
 */

/**
 * @apiDefine NoContent
 * @apiError NoContent[NC] Couldn´t return
 *
 * @apiErrorExample {json} NC-R:
 *      HTTP/1.1 204 The server successfully processed the request and is not returning any content.
 *      {
 *          "message": "Saved and is not returning any content"
 *      }
 */

/**
 * @apiDefine NotFound
 * @apiError NotFound[NF] Server didn´t find request
 *
 * @apiErrorExample {json} NF-R:
 *      HTTP/1.1 404 The requested resource could not be found but may be available in the future. Subsequent requests by the client are permissible.
 *      {
 *          "message": "Document not found"
 *      }
 */

/**
 * @apiDefine BatchUpdate
 * @apiError BatchUpdate[BU] Update multiple documents
 *
 * @apiErrorExample {json} BU-R:
 *      HTTP/1.1 409 Indicates that the request could not be processed because of conflict in the current state of the resource, such as an edit conflict between multiple simultaneous updates.
 *      {
 *          "message": "Batch update process has failed"
 *      }
 */