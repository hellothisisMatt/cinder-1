/**
 * This is the API endpoint for current user operations
 */
const express = require('express');

const router = express.Router();

const mysql = require('promise-mysql');

const MYSQLDB = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const ID_REGEX = /^[0-9]*$/;

const MATCH_ACTION_REGEX = /(?i:like|pass)/;
const MATCH_ACTION_LIKE_REGEX = /like/i;

const MATCH_FOUND_JSON = '{"match":true}';
const MATCH_NOT_FOUND_JSON = '{"match":false}';

router.get('/', (req, res) => {
  mysql.createConnection(MYSQLDB)
    .then((conn) => {
      const rows = conn.query('SELECT * FROM Users');
      conn.end();
      return rows;
    })
    .then((rows) => {
      res.status(200).json(rows);
    }).catch(err => console.error(err));
});

router.get('/:userID', (req, res) => {
  const { userID } = req.params;
  if (!userID.match(ID_REGEX)) {
    return res.status(400).json({ response: 'Invalid user ID' });
  }

  return mysql.createConnection(MYSQLDB)
    .then((conn) => {
      const rows = conn.query('SELECT * FROM Users WHERE UserID = ?', [userID]);
      conn.end();
      return rows;
    })
    .then(rows => res.status(200).json(rows))
    .catch((err) => {
      console.error(err);
      return res.status(500);
    });
});

router.get('/:userID/potentials', (req, res) => {
  const { userID } = req.params;
  if (!userID.match(ID_REGEX)) {
    return res.status(400).json({ response: 'Invalid user ID' });
  }

  return mysql.createConnection(MYSQLDB)
    .then((conn) => {
      const query = mysql.format(`
      SELECT 
        UI.UserID AS userID,
        UI.UserName AS userName,
        TIMESTAMPDIFF(YEAR, UI.Birthday, CURDATE()) AS age,
        UP.PicturePath AS primaryPic
      FROM UsersInfo UI
        LEFT JOIN UserPicture UP
          ON UI.UserID = UP.UserID
          AND UP.PrimaryPicture
        LEFT JOIN (
          SELECT 
            L1.User2ID AS matchUserID
          FROM Likes L1 
            INNER JOIN Likes L2
              ON L1.User2ID = L2.User1ID
          WHERE 
            L1.User1ID = ? 
            AND L2.User2ID = ? 
            AND L1.UserAction = 'L'
            AND L2.UserAction = 'L') AS CurrentMatches
        ON UI.UserID = CurrentMatches.matchUserID
      WHERE
        CurrentMatches.matchUserID IS NULL
        AND UI.UserID != ?
     `, [userID, userID, userID]);

      const rows = conn.query(query);
      conn.end();
      return rows;
    })
    .then(rows => res.status(200).json(rows))
    .catch((err) => {
      console.error(err);
      return res.status(500);
    });
});

router.get('/:userID/matches/:matchUserID/:result', (req, res) => {
  const { userID } = req.params.userID;
  const { matchUserID } = req.params.matchUserID;
  const { result } = req.params.result;

  if (!userID.match(ID_REGEX)) {
    return res.status(400).json({ response: 'Invalid user ID' });
  }
  if (!matchUserID.match(ID_REGEX)) {
    return res.status(400).json({ response: 'Invalid match user ID' });
  }
  if (!result.match(MATCH_ACTION_REGEX)) {
    return res.status(400).json({ response: 'Invalid match action' });
  }

  const userAction = result.match(MATCH_ACTION_LIKE_REGEX) ? 'L' : 'P';

  return mysql.createConnection(MYSQLDB)
    .then((conn) => {
      const insert = mysql.format(`
      INSERT INTO Like (User1ID, User2ID, UserAction)
      VALUES (?, ?, ?);
      `, [userID, matchUserID, userAction]);

      conn.query(insert);

      return conn;
    })
    .then((conn) => {
      const checkMatchQuery = mysql.format(`
      SELECT * 
      FROM Likes L1 
          INNER JOIN Likes L2 
              ON L1.User2ID = L2.User1ID 
      WHERE 
          L1.User1ID =  ? 
          AND L2.User2ID =  ? 
          AND L1.UserAction = 'L' 
          AND L2.UserAction = 'L';
      `, [userID, matchUserID]);

      const isMatched = conn.query(query);
      conn.end();
      isMatched ? res.status(200).json(MATCH_FOUND_JSON) : res.status(200).json(MATCH_NOT_FOUND_JSON);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500);
    });

});

router.post('/login', (req, res) => {
  res.status(200).json({ id: 1 });
});


router.get('/:userID/matches', (req, res) => {
  const { userID } = req.params;
  if (!userID.match(ID_REGEX)) {
    return res.status(400).json({ response: 'Invalid user ID' });
  }

  return mysql.createConnection(MYSQLDB)
    .then((conn) => {
      const rows = conn.query(`
      SELECT 
        L1.User2ID AS userID,
        UI.UserName AS userName,
        GREATEST(L1.ActionDate, L2.ActionDate) AS matchDate,
        UP.PicturePath AS primaryPic
      FROM Likes L1 
        INNER JOIN Likes L2
          ON L1.User2ID = L2.User1ID
        INNER JOIN UsersInfo UI
          ON L1.User2ID = UI.UserID
        LEFT JOIN UserPicture UP
          ON UI.UserID = UP.UserID
          AND UP.PrimaryPicture
      WHERE 
        L1.User1ID =  ? 
        AND L2.User2ID =  ? 
        AND L1.UserAction = 'L'
        AND L2.UserAction = 'L'
      ORDER BY
        matchDate
      `, [userID, userID]);

      conn.end();
      return rows;
    })
    .then(rows => res.status(200).json(rows))
    .catch(err => console.error(err));
});

module.exports = router;
