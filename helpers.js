const getUserByEmail = function(database, email) {
  for (let user in database) {
    if (database[user].email === email) {
      return user;
    }
  }
  return false;
};

module.exports = { getUserByEmail };