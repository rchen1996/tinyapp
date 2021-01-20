const express = require('express');
const app = express();
const PORT = 8080; // default port 8080
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const { getUserByEmail } = require('./helpers');

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
app.use(morgan('dev'));

const urlDatabase = {
  b2xVn2: { longURL: "http://www.lighthouselabs.ca", userID: "aJ48lW" },
  i3BoGr: { longURL: "http://www.google.com", userID: "aJ48lW" }
};

const users = {};

// simulate generating unique shortURL - 6 random alphanumeric characters
const generateRandomString = function() {
  return Math.random().toString(36).substring(2, 8);
};

const urlsForUser = function(id) {
  const userURLs = {};
  for (let url in urlDatabase) {
    if (urlDatabase[url].userID === id) {
      userURLs[url] = urlDatabase[url];
    }
  }
  return userURLs;
};

// homepage (root)
app.get('/', (req, res) => {
  res.send('Hello!');
});

// urlDatabase
app.get('/urls.json', (req, res) => {
  res.json(urlDatabase);
});

// demonstrates can use HTML to display message
app.get('/hello', (req, res) => {
  res.send('<html><body>Hello <b>World</b></body></html>\n');
});

// shows the shortURL longURL pairs
app.get('/urls', (req, res) => {
  // filter urlDatabase comparing userID with user_id from cookie
  const ownedURLs = urlsForUser(req.session.user_id);
  const templateVars = { 
    urls: ownedURLs,
    user: users[req.session.user_id]
  };
  res.render('urls_index', templateVars);
});

// for creating new shortURLs
app.get('/urls/new', (req, res) => {
  const isLoggedIn = req.session.user_id;
  if (isLoggedIn) {
    const templateVars = {
      user: users[isLoggedIn]
    };
    res.render('urls_new', templateVars);
  } else {
    res.redirect('/login');
  }
});

// creates the shortURL and redirects to show user their newly created link
app.post('/urls', (req, res) => {
  const shortURL = generateRandomString();
  urlDatabase[shortURL] = {
    longURL: req.body.longURL,
    userID: req.session.user_id
  };
  res.redirect(`/urls/${shortURL}`);
});

// shows user their shortURL
app.get('/urls/:shortURL', (req, res) => {
  const templateVars = { 
    shortURL: req.params.shortURL,
    longURL: urlDatabase[req.params.shortURL].longURL,
    urlUser: urlDatabase[req.params.shortURL].userID,
    user: users[req.session.user_id]
  };
  res.render('urls_show', templateVars);
});

// updates URL only if it is the user's own shortURL - longURL edited for specified shortURL
app.post('/urls/:shortURL', (req, res) => {
  const isLoggedIn = req.session.user_id;
  if (isLoggedIn === urlDatabase[req.params.shortURL].userID) {
    urlDatabase[req.params.shortURL].longURL = req.body.longURL;
    res.redirect(`/urls/${req.params.shortURL}`);
  }
});

// uses shortURL to redirect to longURL
app.get('/u/:shortURL', (req, res) => {
  const longURL = urlDatabase[req.params.shortURL].longURL;
  res.redirect(longURL);
});

// remove shortURL then redirect back to /urls
app.post('/urls/:shortURL/delete', (req, res) => {
  const isLoggedIn = req.session.user_id;
  if (isLoggedIn === urlDatabase[req.params.shortURL].userID) {
    delete urlDatabase[req.params.shortURL];
    res.redirect('/urls');
  }
});

app.get('/login', (req, res) => {
  const templateVars = { 
    user: users[req.session.user_id]
  };
  res.render('urls_login', templateVars);
});

// allows user to login - redirects to /urls
app.post('/login', (req, res) => {
  const getUser = getUserByEmail(users, req.body.email);
  const comparePasswords = bcrypt.compareSync(req.body.password, getUser.password);
  // user with email not found or password doesn't match
  if (!getUser || !comparePasswords) {
    res.send("403 - Access Forbidden");
  } else {
    // if both checks pass, set user_id cookie with user's random id
    req.session.user_id = getUser.id;
    res.redirect('/urls');
  }
});

// allows users to logout
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/urls');
});

// user registration page
app.get('/register', (req, res) => {
  const templateVars = { 
    user: users[req.session.user_id]
  };
  res.render('urls_register', templateVars);
});

// handles user registration
app.post('/register', (req, res) => {
  const getUser = getUserByEmail(users, req.body.email);
  // checks if email/password are empty/email registered
  if (!req.body.email || !req.body.password || getUser) {
    res.send("400 - Bad Request");
  } else {
    const newUserID = generateRandomString();
    const bcryptPassword = bcrypt.hashSync(req.body.password, 10);
    const newUser = {
      id: newUserID,
      email: req.body.email,
      password: bcryptPassword
    };
    users[newUserID] = newUser;
    req.session.user_id = newUserID;
    res.redirect('/urls');
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});