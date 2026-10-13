import { USER_ROLES } from '../config/constants.js';
import { sendError } from '../utils/apiResponse.js';

export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required.', 401);
  }

  if (req.user.role !== USER_ROLES.ADMIN) {
    return sendError(
      res,
      'Access denied. Admin privileges are required to perform this action.',
      403
    );
  }

  next();
};
