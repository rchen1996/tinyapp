const express = require('express');
const app = express();
const PORT = 8080; // default port 8080
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const { getUserByEmail, generateRandomString, urlsForUser  } = require('./helpers');

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

// homepage (root)
app.get('/', (req, res) => {
  const isLoggedIn = req.session.user_id;
  if (isLoggedIn) {
    res.redirect('/urls');
  } else {
    res.redirect('/login');
  }
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
  const isLoggedIn = req.session.user_id;
  const shortURL = generateRandomString();
  if (isLoggedIn) {
    urlDatabase[shortURL] = {
      longURL: req.body.longURL,
      userID: isLoggedIn
    };
    res.redirect(`/urls/${shortURL}`);
  } else {
    const templateVars = {
      user: users[isLoggedIn]
    };
    res.render('urls_new_error', templateVars);
  }
});

// shows user their shortURL
app.get('/urls/:shortURL', (req, res) => {
  const shortURL = req.params.shortURL;
  const templateVars = {
    urlDatabase,
    shortURL,
    user: users[req.session.user_id]
  };
  if (!urlDatabase[shortURL]) {
    res.render('urls_show', templateVars);
  } else {
      templateVars.longURL = urlDatabase[req.params.shortURL].longURL;
      templateVars.urlUser = urlDatabase[req.params.shortURL].userID;
    res.render('urls_show', templateVars);
  }
});

// updates URL only if it is the user's own shortURL - longURL edited for specified shortURL
app.post('/urls/:shortURL', (req, res) => {
  const isLoggedIn = req.session.user_id;
  if (isLoggedIn === urlDatabase[req.params.shortURL].userID) {
    urlDatabase[req.params.shortURL].longURL = req.body.longURL;
    res.redirect('/urls');
  } else {
    templateVars = {
      user: isLoggedIn,
    }
    res.render('urls_show_error', templateVars);
  }
});

// uses shortURL to redirect to longURL
app.get('/u/:shortURL', (req, res) => {
  const shortURL = req.params.shortURL;
  if (urlDatabase[shortURL]) {
    const longURL = urlDatabase[shortURL].longURL;
    res.redirect(longURL);
  } else {
    const templateVars = {
      urlDatabase,
      shortURL,
      user: users[req.session.user_id]
    };
    res.render('urls_show', templateVars);
  }
});

// remove shortURL then redirect back to /urls
app.post('/urls/:shortURL/delete', (req, res) => {
  const isLoggedIn = req.session.user_id;
  if (isLoggedIn === urlDatabase[req.params.shortURL].userID) {
    delete urlDatabase[req.params.shortURL];
    res.redirect('/urls');
  } else {
    templateVars = {
      user: users[req.session.user_id]
    };
    res.render('urls_delete_error', templateVars);
  }
});

app.get('/login', (req, res) => {
  const isLoggedIn = req.session.user_id;
  const invalidParams = false;
  if (isLoggedIn) {
    res.redirect('/urls');
  } else {
    const templateVars = { 
      user: users[isLoggedIn],
      error: invalidParams
    };
    res.render('urls_login', templateVars);
  }
});

// allows user to login - redirects to /urls
app.post('/login', (req, res) => {
  const getUser = getUserByEmail(users, req.body.email);
  const invalidParams = true;
  if (!getUser) {
    const templateVars = { 
      user: users[req.session.user_id],
      error: invalidParams
    };
    res.render('urls_login', templateVars);
  } else {
    const samePasswords = bcrypt.compareSync(req.body.password, getUser.password);
    if (samePasswords) {
      req.session.user_id = getUser.id;
      res.redirect('/urls');
    } else {
      const templateVars = { 
        user: users[req.session.user_id],
        error: invalidParams
      };
      res.render('urls_login', templateVars);
    }
  }
});

// allows users to logout
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/urls');
});

// user registration page
app.get('/register', (req, res) => {
  const isLoggedIn = req.session.user_id;
  if (isLoggedIn) {
    res.redirect('/urls');
  } else {
    const templateVars = { 
      user: users[isLoggedIn],
      invalidParams: false,
      getUser: false
    };
    res.render('urls_register', templateVars);
  }
});

// handles user registration
app.post('/register', (req, res) => {
  const getUser = getUserByEmail(users, req.body.email);
  // checks if email/password are empty/email registered
  if (!req.body.email || !req.body.password) {
    const templateVars = { 
      user: users[req.session.user_id],
      invalidParams: true,
      getUser
    };
    res.render('urls_register', templateVars);
  } else if (getUser) {
    const templateVars = { 
      user: users[req.session.user_id],
      invalidParams: false,
      getUser
    };
    res.render('urls_register', templateVars);
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