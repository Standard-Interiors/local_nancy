const { query } = require('./db');

// Real schema: MS_User has Email (not EmailId), no StoreId, no IsActive
async function findUserByEmail(email) {
  const result = await query(
    `SELECT u.UserId, u.UserName, u.Email, u.RoleId, u.IsDeleted, u.IsAdminAccess,
            la.password_hash, la.hash_key
     FROM MS_User u
     LEFT JOIN local_auth_users la ON u.UserId = la.UserId
     WHERE u.Email = @email`,
    { email }
  );
  return result.recordset[0] || null;
}

async function findUserByHashKey(hashKey) {
  const result = await query(
    `SELECT u.UserId, u.UserName, u.Email, u.RoleId, u.IsDeleted, u.IsAdminAccess,
            la.password_hash, la.hash_key
     FROM MS_User u
     INNER JOIN local_auth_users la ON u.UserId = la.UserId
     WHERE la.hash_key = @hashKey`,
    { hashKey }
  );
  return result.recordset[0] || null;
}

async function findUserById(userId) {
  const result = await query(
    `SELECT u.UserId, u.UserName, u.Email, u.RoleId, u.IsDeleted, u.IsAdminAccess,
            la.password_hash, la.hash_key
     FROM MS_User u
     LEFT JOIN local_auth_users la ON u.UserId = la.UserId
     WHERE u.UserId = @userId`,
    { userId }
  );
  return result.recordset[0] || null;
}

module.exports = { findUserByEmail, findUserByHashKey, findUserById };
