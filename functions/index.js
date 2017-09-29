'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const uuidv4 = require('uuid/v4');
admin.initializeApp(functions.config().firebase);

const express = require('express');
const app = express();

// Validate the user is logged in taking the Firebase JWT, and adding uid and email to the req.user
const validateFirebaseIdToken = (req, res, next) => {
    console.log('Check if request is authorized with Firebase ID token');

    if (req.originalUrl == '/healthz') {
        return res.send({status: true});
    }

    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return res.status(403).send('Unauthorized');
    }

    // Read the ID Token from the Authorization header.
    let idToken = req.headers.authorization.split('Bearer ')[1];

    admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
        console.log('ID Token correctly decoded', decodedIdToken);
        req.user = decodedIdToken;
        next();
    }).catch(error => {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    });
};

app.use(validateFirebaseIdToken);

app.get('/requests', (req, res) => {
    admin.database().ref(`friend-requests/received/${req.user.uid}`).once('value').then(requests => res.send(requests.val()));
});

app.post('/request', (req, res) => {
    const senderId = req.user.uid;
    const receiverId = req.body.receiver_id;
    const data = {
        sender_id: senderId,
        receiver_id: receiverId,
        ts: Date.now()
    };
    admin.database().ref(`friend-requests/sent/${senderId}/${receiverId}`).set(data, function (error) {
        admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).set(data, function (error) {
            if (error)
                res.send({error: error})
            else
                res.send({success: true});
        });
    });
});

app.post('/accept', (req, res) => {
    const senderId = req.body.sender_id;
    const receiverId = req.user.uid;
    admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).once('value').then(friend_request => {
        admin.database().ref(`friend-requests/received/${receiverId}/${senderId}`).remove()
        admin.database().ref(`friend-requests/sent/${senderId}/${receiverId}`).remove()
        res.send({success:true})
    });
});


exports.friend = functions.https.onRequest(app);
