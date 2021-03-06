const express = require('express');
const app = express();
const PORT = 8080;
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const { getUserByEmail, generateRandomString, urlsForUser  } = require('./helpers');
const methodOverride = require('method-override');

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
app.use(morgan('dev'));
app.use(methodOverride('_method'));

const urlDatabase = {
  b2xVn2: { longURL: "http://www.lighthouselabs.ca", userID: "aJ48lW" },
  i3BoGr: { longURL: "http://www.google.com", userID: "aJ48lW" }
};

const users = {};

app.get('/', (req, res) => {
  const userId = req.session.user_id;
  if (userId) {
    res.redirect('/urls');
  } else {
    res.redirect('/login');
  }
});

// shows the shortURL longURL pairs owned by user
app.get('/urls', (req, res) => {
  if (req.session.user_id) {
    const ownedURLs = urlsForUser(urlDatabase, req.session.user_id);
    const templateVars = {
      urls: ownedURLs,
      user: users[req.session.user_id],
    };
    res.render('urls_index', templateVars);
  } else {
    const templateVars = {
      urls: null,
      user: users[req.session.user_id],
    };
    res.render('urls_index', templateVars);
  }
});

// for creating new shortURLs
app.get('/urls/new', (req, res) => {
  const userId = req.session.user_id;
  if (userId) {
    const templateVars = {
      user: users[userId]
    };
    res.render('urls_new', templateVars);
  } else {
    res.redirect('/login');
  }
});

// creates shortURL
app.post('/urls', (req, res) => {
  const userId = req.session.user_id;
  if (userId) {
    const shortURL = generateRandomString();
    const currentDate = new Date();
    urlDatabase[shortURL] = {
      longURL: req.body.longURL,
      userID: userId,
      dateCreated: currentDate.toLocaleDateString(),
      totalVisits: 0,
      uniqueVisits: 0,
      visitorLog: []
    };
    res.redirect(`/urls/${shortURL}`);
  } else {
    const templateVars = {
      user: users[userId]
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

// edits URL only if it is the user's own shortURL
app.put('/urls/:shortURL', (req, res) => {
  const userId = req.session.user_id;
  if (userId === urlDatabase[req.params.shortURL].userID) {
    urlDatabase[req.params.shortURL].longURL = req.body.longURL;
    res.redirect('/urls');
  } else {
    const templateVars = {
      user: userId,
    };
    res.render('urls_show_error', templateVars);
  }
});

// uses shortURL to redirect to longURL
app.get('/u/:shortURL', (req, res) => {
  const shortURL = req.params.shortURL;
  if (urlDatabase[shortURL]) {
    const longURL = urlDatabase[shortURL].longURL;
    // analytics: total/unique visits, timestamp
    urlDatabase[shortURL].totalVisits += 1;
    const visitorId = generateRandomString();
    if (!req.session[`visitor_id_${shortURL}`]) {
      req.session[`visitor_id_${shortURL}`] = visitorId;
      urlDatabase[shortURL].uniqueVisits += 1;
    }
    const currentDate = new Date();
    const visitLog = {
      timestamp: currentDate.toLocaleString('en-US', { timeZone: 'America/New_York' }),
      visitorId: req.session[`visitor_id_${shortURL}`]
    };
    urlDatabase[shortURL].visitorLog.push(visitLog);
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

// remove shortURL only if owned
app.delete('/urls/:shortURL/delete', (req, res) => {
  const userId = req.session.user_id;
  if (userId === urlDatabase[req.params.shortURL].userID) {
    delete urlDatabase[req.params.shortURL];
    res.redirect('/urls');
  } else {
    const templateVars = {
      user: users[req.session.user_id]
    };
    res.render('urls_delete_error', templateVars);
  }
});

app.get('/login', (req, res) => {
  const userId = req.session.user_id;
  const invalidParams = false;
  if (userId) {
    res.redirect('/urls');
  } else {
    const templateVars = {
      user: users[userId],
      error: invalidParams
    };
    res.render('urls_login', templateVars);
  }
});

app.post('/login', (req, res) => {
  const user = getUserByEmail(users, req.body.email);
  const invalidParams = true;
  // if user exists & passwords match login, else display error
  if (!user) {
    const templateVars = {
      user: users[req.session.user_id],
      error: invalidParams
    };
    res.render('urls_login', templateVars);
  } else {
    const samePasswords = bcrypt.compareSync(req.body.password, user.password);
    if (samePasswords) {
      req.session.user_id = user.id;
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

app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/urls');
});

app.get('/register', (req, res) => {
  const userId = req.session.user_id;
  if (userId) {
    res.redirect('/urls');
  } else {
    const templateVars = {
      user: users[userId],
      invalidParams: false,
      userId: false
    };
    res.render('urls_register', templateVars);
  }
});

app.post('/register', (req, res) => {
  const userId = getUserByEmail(users, req.body.email);
  // checks if email/password are empty/email registered - displays error, otherwise create acc
  if (!req.body.email || !req.body.password) {
    const templateVars = {
      user: users[req.session.user_id],
      invalidParams: true,
      userId
    };
    res.render('urls_register', templateVars);
  } else if (userId) {
    const templateVars = {
      user: users[req.session.user_id],
      invalidParams: false,
      userId
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
  console.log(`TinyApp listening on port ${PORT}!`);
});