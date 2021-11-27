const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const base64 = require('base-64');
const app = express();
const port = 65100;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { connection } = require('./mysql');
const { json } = require('body-parser');
const e = require('express');
const { request, application } = require('express');

app.get('/', (req, res) => {
    res.send('hello world!');
    return;
});

app.get('/user', (req, res) => {
    // const { id } = base64.decode(req.body.id);
    const id = req.body;
    connection.query(`SELECT * FROM user WHERE user_id = '${id}'`, (error, results) => {
        if (error) {
            res.status(500).json(error);
            return;
        }
        res.status(200).json(results);
    });
});
// and ,
app.post('/auth', (req, res) => {
    const { id, password } = req.body;
    connection.query(`SELECT * FROM user WHERE user_id = '${id}'`, function (error, results) {
        if (results.length == 0) {
            res.status(403).json({
                code: 1,
                message: '아이디를 확인해 주세요.',
            });
            return;
        }
        connection.query(
            `SELECT * FROM user WHERE user_id = '${id}' and password = SHA2('${password}',512)`,
            function (error, results) {
                if (results.length == 0) {
                    res.status(403).json({
                        code: 2,
                        message: '비밀번호를 확인해 주세요.',
                    });
                    return;
                }
                connection.query(
                    `INSERT INTO LoginHistory(user_id,nickname,created_at) VALUES('${id}','${results[0].nickname}', NOW())`,
                    function (error, results) {
                        if (error) {
                            console.log(error);
                            return;
                        }
                    }
                );
                res.status(200).json(results);
            }
        );
    });
});

app.post('/join', (req, res) => {
    const { id, password, nickname } = req.body;
    // const password = sha512(req.body.password);
    console.log(password);

    //validation(검사) 이 맨 위에 있어야 함
    connection.query(`SELECT * FROM user WHERE user_id = '${id}'`, function (error, results) {
        if (error) {
            console.log(error);
            res.status(500).json({
                message: error.message,
            });
            return;
        }

        if (results.length >= 1) {
            res.status(403).json({
                code: 1,
                message: '이미 존재하는 아이디입니다.',
            });
            return;
        }

        connection.query(`SELECT * FROM user WHERE nickname = '${nickname}'`, function (error, results) {
            if (error) {
                console.log(error);
                res.status(500).json({
                    message: error.message,
                });
                return;
            }

            if (results.length >= 1) {
                res.status(403).json({
                    code: 2,
                    message: '이미 존재하는 닉네임입니다.',
                });
                return;
            }
        });

        //nickname까지 검사한 후 맨 마지막에 넣는 query
        connection.query(
            `INSERT INTO user(user_id, password, nickname) VALUES('${id}', SHA2('${password}', 512), '${nickname}')`,
            function (error, results) {
                if (error) {
                    console.log(error);
                    res.status(500).json({
                        message: error.message,
                    });
                    return;
                }
                res.status(200).json(results);
            }
        );
    });
});

app.post('/rank', (req, res) => {
    const { finalScore, currentNickname } = req.body;

    connection.query(
        `INSERT INTO RankHistory(score, nickname) VALUES('${finalScore}','${currentNickname}')`,
        function (error, results) {
            if (error) {
                console.log(error);
                res.status(500).json({
                    erorrMessage: error,
                });
                return;
            }
        }
    );
    connection.query(`SELECT * FROM RankHistory`, function (error, results) {
        if (error) {
            console.log(error);
            return;
        }
        const scoreList = [];
        const nicknameList = [];
        const highestScore = [];
        const highestScoreNicknameList = [];
        const secondHighestScore = [];
        const secondHighestScoreNicknameList = [];
        const thirdHighestScore = [];
        const thirdHighestScoreNicknameList = [];

        function getRankedList(score, nicknamelst, scorelst) {
            for (i = 0; i < results.length; i++) {
                if (scorelst[i] == Math.max(...scorelst)) {
                    if (score.includes(scorelst[i])) {
                    } else {
                        score.push(scorelst[i]);
                    }

                    if (nicknamelst.includes(nicknameList[i])) {
                    } else {
                        nicknamelst.push(nicknameList[i]);
                    }
                }
            }
            return score, nicknamelst;
        }

        // scoreList에 모든 score 정보를 담고, nicknameList에 모든 nickname 정보를 담는다.
        for (let i = 0; i < results.length; i++) {
            scoreList.push(results[i].score);
            nicknameList.push(results[i].nickname);
        }

        getRankedList(highestScore, highestScoreNicknameList, scoreList);
        const highestScoreRemovedList = scoreList.filter((score) => score != highestScore[0]);

        getRankedList(secondHighestScore, secondHighestScoreNicknameList, highestScoreRemovedList);
        const secondHighestScoreRemovedList = highestScoreRemovedList.filter((score) => score != secondHighestScore[0]);

        getRankedList(thirdHighestScore, thirdHighestScoreNicknameList, secondHighestScoreRemovedList);

        res.status(200).json({
            highestScore: highestScore,
            highestScoreNicknameList: highestScoreNicknameList,
            secondHighestScore: secondHighestScore,
            secondHighestScoreNicknameList: secondHighestScoreNicknameList,
            thirdHighestScore: thirdHighestScore,
            thirdHighestScoreNicknameList: thirdHighestScoreNicknameList,
        });
    });
});

app.listen(port, () => {
    console.log(`example service app listening at http://localhost:${port}`);
});
