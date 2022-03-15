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

// 회원가입
app.post('/join', (req, res) => {
    const { user_id, nickname, password } = req.body;

    //validation(검사) 이 맨 위에 있어야 함
    connection.query(
        `
        SELECT 
            * 
        FROM user 
        WHERE 1 = 1
        AND user_id = '${user_id}'
        `,
        function (error, results) {
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

            connection.query(
                `
                SELECT 
                    * 
                FROM user 
                WHERE 1 = 1
                AND nickname = '${nickname}'
                `,
                function (error, results) {
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
                }
            );

            //nickname까지 검사한 후 맨 마지막에 넣는 query
            connection.query(
                `
                INSERT INTO 
                    user(user_id, password, nickname) 
                VALUES('${user_id}', SHA2('${password}', 512), '${nickname}')
                `,
                function (error, results) {
                    if (error) {
                        console.log(error);
                        res.status(500).json({
                            message: error.message,
                        });
                        return;
                    }
                    connection.query(
                        `SELECT 
                            id 
                        FROM user 
                        WHERE 1 = 1
                        AND user_id = '${user_id}'
                        `,
                        (error, result) => {
                            if (error) {
                                console.log(error);
                                return;
                            }
                            // console.log(result);
                            res.status(200).json(result);
                        }
                    );
                }
            );
        }
    );
});

// 로그인
app.post('/auth', (req, res) => {
    const { user_id, password } = req.body;
    connection.query(
        `
        SELECT 
            * 
        FROM user 
        WHERE 1 = 1
        AND user_id = '${user_id}'
        `,
        function (error, results) {
            if (results.length == 0) {
                res.status(403).json({
                    code: 1,
                    message: '아이디를 확인해 주세요.',
                });
                return;
            }
            connection.query(
                `
                SELECT 
                    * 
                FROM user 
                WHERE 1 = 1
                AND user_id = '${user_id}' 
                and password = SHA2('${password}',512)
                `,
                function (error, results) {
                    if (results.length == 0) {
                        res.status(403).json({
                            code: 2,
                            message: '비밀번호를 확인해 주세요.',
                        });
                        return;
                    }
                    connection.query(
                        `
                    SELECT 
                        id, nickname 
                    FROM user 
                    WHERE 1 = 1
                    AND user_id = '${user_id}'
                    `,
                        (error, results) => {
                            if (error) {
                                console.log(error);
                                return;
                            }
                            res.status(200).json(results);
                        }
                    );
                }
            );
        }
    );
});

// 게임 시작 후 티켓 발행
app.post('/ticket', (req, res) => {
    const { id } = req.body;
    connection.query(
        `
        INSERT INTO 
            GAME_TICKET(user_id) 
        VALUES('${id}')
        `,
        (error, results) => {
            if (error) {
                console.log(error);
                return;
            }
            res.status(200).json(results);
        }
    );
});

app.post('/game', (req, res) => {
    const { id, answer, guess, nickname } = req.body;
    const getScore = (guess, answer) => {
        let _strike = 0;
        let _ball = 0;
        let _out = 0;

        for (let answerIndex = 0; answerIndex < guess.length; answerIndex++) {
            if (answer[answerIndex] === guess[answerIndex]) {
                _strike += 1;
            } else if (guess.includes(answer[answerIndex])) {
                _ball += 1;
            } else {
                _out += 1;
            }
        }

        return { strike: _strike, ball: _ball, out: _out };
    };
    const { strike, ball, out } = getScore(guess, answer);

    // game_round_history 와 game_ticket 연결
    connection.query(
        `
        SELECT 
            id 
        FROM GAME_TICKET 
        WHERE user_id = '${id}'
        ORDER BY created_at DESC 
        LIMIT 1
        `,
        (error, result) => {
            if (error) {
                console.log(error);
                return;
            }
            connection.query(
                `
                INSERT INTO 
                GAME_ROUND_HISTORY(guess, user_id, strike_count, ball_count, out_count, game_ticket_id) 
                VALUES('${guess}', '${id}', '${strike}', '${ball}', '${out}','${result[0].id}')
                `,
                (error, results) => {
                    if (error) {
                        console.log(error);
                        return;
                    }
                }
            );

            connection.query(
                `
                SELECT 
                    guess, strike_count, ball_count, out_count
                FROM GAME_ROUND_HISTORY 
                WHERE 1 = 1
                AND game_ticket_id = '${result[0].id}'
                ORDER BY id DESC 
                LIMIT 1
                `,
                (error, results) => {
                    if (error) {
                        console.log(error);
                        return;
                    }
                    res.status(200).json(results);
                }
            );
        }
    );
});

// 게임의 정답을 맞추었을 때 update : score, deleted_at 후에 table이 생성된 시간과 삭제된 시간을 select
app.post('/gameEnd', (req, res) => {
    const { id, score } = req.body;
    connection.query(
        `
        UPDATE GAME_TICKET 
        SET 
            score = ${score}, 
            deleted_at = NOW() 
        WHERE 1 = 1 
        AND user_id = '${id}' 
        ORDER BY created_at DESC
        LIMIT 1
        `,
        (err, results) => {
            if (err) {
                console.log(err);
                return;
            }
            connection.query(
                `
                SELECT 
                    RUN_TIME
                FROM 
                (
                    SELECT
                    *,
                    TIME_TO_SEC(TIMEDIFF(deleted_at, created_at)) AS RUN_TIME
                    FROM
                    GAME_TICKET
                ) AS GAME_TICKET_WITH_RUN_TIME
                WHERE 1 = 1 
                AND user_id = '${id}'
                ORDER BY created_at DESC
                LIMIT 1
                `,
                (error, result) => {
                    if (error) {
                        console.log(error);
                        return;
                    }
                    res.status(200).json(result);
                }
            );
        }
    );
});

// 명예의 전당
app.post('/rank', (req, res) => {
    let highestScore;
    let secondHighestScore;
    let thirdHighestScore;
    let highestScoreNicknameList = [];
    let secondHighestScoreNicknameList = [];
    let thirdHighestScoreNicknameList = [];
    // 1등 리스트, 스코어 추출
    connection.query(
        `
        SELECT 
            * 
        FROM (
            SELECT 
                score, nickname, ROW_NUMBER() 
            OVER (PARTITION BY gt.user_id ORDER BY score DESC ) AS RankNo 
            FROM (GAME_TICKET AS gt JOIN USER as u ON gt.user_id = u.id )
        ) top_rank
        WHERE 1 = 1
        AND RankNo = 1 
        AND score = (SELECT MAX(score) FROM GAME_TICKET)
        `,
        (error, results) => {
            if (error) {
                console.log(error);
                return;
            }
            if (results && results.length > 0) {
                highestScore = results[0].score;
                for (i = 0; i < results.length; i++) {
                    highestScoreNicknameList.push(results[i].nickname);
                }
            }

            // 2등 리스트, 스코어 추출
            connection.query(
                `
                SELECT * FROM (
                    SELECT 
                        score, nickname, ROW_NUMBER() 
                    OVER (PARTITION BY gt.user_id ORDER BY score DESC ) AS RankNo 
                    FROM (GAME_TICKET AS gt JOIN USER as u ON gt.user_id = u.id )
                ) top_rank
                WHERE 1 = 1
                AND RankNo = 1 
                AND score = (SELECT MAX(score) FROM GAME_TICKET WHERE score < (SELECT MAX(score) FROM GAME_TICKET))
                `,
                (error, results) => {
                    if (error) {
                        console.log(error);
                        return;
                    }
                    if (results && results.length > 0) {
                        secondHighestScore = results[0].score;
                        for (i = 0; i < results.length; i++) {
                            secondHighestScoreNicknameList.push(results[i].nickname);
                        }
                    }

                    // 3등 리스트, 스코어 추출
                    connection.query(
                        `
                        SELECT * FROM (
                            SELECT 
                                score, nickname, ROW_NUMBER() 
                            OVER (PARTITION BY gt.user_id ORDER BY score DESC ) AS RankNo 
                            FROM (GAME_TICKET AS gt JOIN USER as u ON gt.user_id = u.id )
                        ) top_rank
                        WHERE 1 = 1
                        AND RankNo = 1 
                        AND score = (SELECT MAX(score) FROM GAME_TICKET WHERE score < ((SELECT MAX(score) FROM GAME_TICKET WHERE score < (SELECT MAX(score) FROM GAME_TICKET))))
                        `,
                        (error, results) => {
                            if (error) {
                                console.log(error);
                                return;
                            }
                            console.log(results);
                            if (results && results.length > 0) {
                                thirdHighestScore = results[0].score;
                                for (i = 0; i < results.length; i++) {
                                    thirdHighestScoreNicknameList.push(results[i].nickname);
                                }
                            } else {
                            }
                            // // 스코어 랭킹에 겹치는 이름이 없도록 filtering
                            // secondHighestScoreNicknameList = secondHighestScoreNicknameList.filter(
                            //     (n) => !highestScoreNicknameList.includes(n)
                            // );
                            // thirdHighestScoreNicknameList = thirdHighestScoreNicknameList.filter(
                            //     (n) =>
                            //         !highestScoreNicknameList.includes(n) && !secondHighestScoreNicknameList.includes(n)
                            // );
                            res.status(200).json({
                                highestScore: highestScore,
                                secondHighestScore: secondHighestScore,
                                thirdHighestScore: thirdHighestScore,
                                highestScoreNicknameList: highestScoreNicknameList,
                                secondHighestScoreNicknameList: secondHighestScoreNicknameList,
                                thirdHighestScoreNicknameList: thirdHighestScoreNicknameList,
                            });
                        }
                    );
                }
            );
        }
    );
});

app.listen(port, () => {
    console.log(`example service app listening at http://localhost:${port}`);
});
