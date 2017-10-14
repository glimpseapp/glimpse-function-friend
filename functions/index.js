'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const uuidv4 = require('uuid/v4');
admin.initializeApp(functions.config().firebase);

const express = require('express');
const app = express();

// Validate the user is logged in taking the Firebase JWT, and adding uid and email to the req.user
const validateFirebaseIdToken = (req, res, next) => {
    if (req.originalUrl == '/healthz') {
        return res.send({status: true});
    }

    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return res.status(403).send('Unauthorized');
    }

    // Read the ID Token from the Authorization header.
    let idToken = req.headers.authorization.split('Bearer ')[1];

    admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
        console.log('Authenticated ', decodedIdToken.email);
        req.user = decodedIdToken;
        next();
    }).catch(error => {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    });
};

app.use(validateFirebaseIdToken);

app.get('/friends', (req, res) => {
    admin.database().ref(`friends/${req.user.uid}`).once('value').then(requests => {
	    friends = requests.val();
	    res.send({
		    "results": friends.length,
		    "friends": friends
	    });
    });
});

app.get('/requests', (req, res) => {
    admin.database().ref(`friend-requests/received/${req.user.uid}`).once('value').then(requests => res.send(requests.val()));
});

app.post('/request', (req, res) => {
    const senderId = req.user.uidw;
    const receiverId = req.body.receiver_id;
    const data = {
        sender_id: senderId,
        receiver_id: receiverId,
        ts: Date.now()
    };
    admin.database().ref(`friend-requests/sent/${senderId}/${receiverId}`).set(data, function (error1) {
        admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).set(data, function (error2) {
            var errors = []
            if (error1)
                errors.push(error1)
            if (error2)
                errors.push(error2)
            if (error1 || error2)
                res.send({error: errors})
            else

            res.send({success: true});
        });
    });
});

app.post('/accept', (req, res) => {
    const senderId = req.body.sender_id;
    const receiverId = req.user.uid;
    admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).once('value').then(data => {
        admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).remove()
        admin.database().ref(`friend-requests/sent/${senderId}/${receiverId}`).remove()

        const friend_data1 = {
            user_id: receiverId,
            rel_user_id: senderId
        }
        const friend_data2 = {
            user_id: senderId,
            rel_user_id: receiverId
        }

        admin.database().ref(`friends/${receiverId}/${senderId}`).set(friend_data1, function (error1) {
            admin.database().ref(`friends/${senderId}/${receiverId}`).set(friend_data2, function (error2) {
                var errors = []
                if (error1)
                    errors.push(error1)
                if (error2)
                    errors.push(error2)
                if (error1 || error2)
                    res.send({error: errors})
                else
                    res.send({success: true});
            });
        });


    });
});

app.post('/reject', (req, res) => {
    const senderId = req.body.sender_id;
    const receiverId = req.user.uid;
    admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).once('value').then(friend_request => {
        admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).remove()
        admin.database().ref(`friend-requests/sent/${senderId}/${receiverId}`).remove()
        res.send({success: true})
    });
});


exports.friend = functions.https.onRequest(app);
