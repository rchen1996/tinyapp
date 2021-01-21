const getUserByEmail = function(database, email) {
  for (let user in database) {
    if (database[user].email === email) {
      return database[user];
    }
  }
};

// simulate generating unique shortURL - 6 random alphanumeric characters
const generateRandomString = function() {
  return Math.random().toString(36).substring(2, 8);
};

const urlsForUser = function(database, id) {
  const userURLs = {};
  for (let url in database) {
    if (database[url].userID === id) {
      userURLs[url] = database[url];
    }
  }
  return userURLs;
};

module.exports = { getUserByEmail, generateRandomString, urlsForUser };